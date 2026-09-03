import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { createNote, deleteNote } from '$lib/server/notes-service.js';
import { saveAttachment } from '$lib/server/attachments.js';
import { validateQuickCaptureToken } from '$lib/server/quick-capture-tokens.js';
import { checkIpRateLimit } from '$lib/server/ip-rate-limit.js';
import { buildCaptureDraft } from '$lib/utils/capture.js';

const captureInputSchema = z.object({
	input: z.string().trim().max(50_000).optional().default(''),
	title: z.string().trim().max(500).optional(),
	url: z.string().trim().max(4_096).optional(),
	tags: z.string().trim().max(1_000).optional()
}).strict();

const noStoreHeaders = { 'Cache-Control': 'no-store' };
const MAX_IMAGES = 10;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_IMAGE_SIZE = 50 * 1024 * 1024;

interface CaptureRequest {
	input: string;
	title?: string;
	url?: string;
	tags?: string;
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
			tags: formText(formData, 'tags')
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
	if (!capture.input && !capture.url && capture.images.length === 0) {
		return json({ error: 'Capture must contain text, a URL, or an image' }, { status: 400, headers: noStoreHeaders });
	}
	if (capture.images.length > MAX_IMAGES) {
		return json({ error: `A capture can contain at most ${MAX_IMAGES} images` }, { status: 400, headers: noStoreHeaders });
	}
	if (capture.images.some((file) => !file.type.startsWith('image/'))) {
		return json({ error: 'Only image files are allowed' }, { status: 400, headers: noStoreHeaders });
	}
	if (capture.images.some((file) => file.size > MAX_IMAGE_SIZE)) {
		return json({ error: 'Each image must be 10MB or smaller' }, { status: 400, headers: noStoreHeaders });
	}
	if (capture.images.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_IMAGE_SIZE) {
		return json({ error: 'Images must be 50MB or smaller in total' }, { status: 400, headers: noStoreHeaders });
	}

	const draft = buildCaptureDraft({
		title: capture.title || (capture.images.length > 0 ? `Shared image${capture.images.length === 1 ? '' : 's'}` : undefined),
		text: capture.input,
		url: capture.url,
		tags: capture.tags
	});
	const crumb = createNote(db, userId, draft);
	try {
		for (const [index, image] of capture.images.entries()) {
			await saveAttachment(db, crumb.id, image, userId, null, index === 0);
		}
	} catch {
		await deleteNote(db, userId, crumb.id);
		return json({ error: 'Could not save the captured images' }, { status: 500, headers: noStoreHeaders });
	}
	return json(
		{ message: 'Crumb captured', crumb: { id: crumb.id, title: crumb.title } },
		{ status: 201, headers: noStoreHeaders }
	);
};
