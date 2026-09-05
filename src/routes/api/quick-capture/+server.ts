import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { validateQuickCaptureToken } from '$lib/server/quick-capture-tokens.js';
import { checkIpRateLimit } from '$lib/server/ip-rate-limit.js';
import { CAPTURE_CLIENTS, CAPTURE_MODES } from '$lib/utils/capture.js';
import { captureCrumb, CaptureValidationError } from '$lib/server/capture-service.js';

const captureInputSchema = z.object({
	input: z.string().trim().max(50_000).optional().default(''),
	title: z.string().trim().max(500).optional(),
	url: z.string().trim().max(4_096).optional(),
	tags: z.string().trim().max(1_000).optional(),
	mode: z.enum(CAPTURE_MODES).optional(),
	client: z.enum(CAPTURE_CLIENTS).optional(),
	clientVersion: z.string().trim().max(32).optional()
}).strict();

const noStoreHeaders = { 'Cache-Control': 'no-store' };

type CaptureFields = z.infer<typeof captureInputSchema>;

interface CaptureRequest extends CaptureFields {
	images: File[];
}

function formText(formData: FormData, key: string): string | undefined {
	const value = formData.get(key);
	return typeof value === 'string' ? value : undefined;
}

async function parseCaptureRequest(request: Request): Promise<CaptureRequest | null> {
	const contentType = request.headers.get('content-type') ?? '';
	if (contentType.includes('multipart/form-data')) {
		const formData = await request.formData();
		const parsed = captureInputSchema.safeParse({
			input: formText(formData, 'input') ?? '',
			title: formText(formData, 'title'),
			url: formText(formData, 'url'),
			tags: formText(formData, 'tags'),
			mode: formText(formData, 'mode'),
			client: formText(formData, 'client'),
			clientVersion: formText(formData, 'clientVersion')
		});
		if (!parsed.success) return null;
		return {
			...parsed.data,
			images: formData.getAll('images').filter((value): value is File => typeof value !== 'string')
		};
	}

	const parsed = captureInputSchema.safeParse(await request.json());
	return parsed.success ? { ...parsed.data, images: [] } : null;
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!checkIpRateLimit(`quick-capture:${getClientAddress()}`)) {
		return json({ error: 'Too many requests' }, { status: 429, headers: noStoreHeaders });
	}

	const authorization = request.headers.get('authorization');
	const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
	const userId = validateQuickCaptureToken(token, db);
	if (!userId) {
		return json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
	}

	let capture: CaptureRequest | null;
	try {
		capture = await parseCaptureRequest(request);
	} catch {
		return json({ error: 'Request body must be valid JSON or multipart form data' }, { status: 400, headers: noStoreHeaders });
	}
	if (!capture) {
		return json({ error: 'Invalid capture fields' }, { status: 400, headers: noStoreHeaders });
	}
	try {
		const result = await captureCrumb(db, userId, {
			...capture,
			idempotencyKey: request.headers.get('idempotency-key')?.trim().slice(0, 256) || undefined
		});
		return json(result, { status: result.replayed ? 200 : 201, headers: noStoreHeaders });
	} catch (error) {
		if (error instanceof CaptureValidationError) {
			return json({ error: error.message }, { status: 400, headers: noStoreHeaders });
		}
		return json({ error: 'Could not capture crumb' }, { status: 500, headers: noStoreHeaders });
	}
};
