import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { createNote } from '$lib/server/notes-service.js';
import { validateQuickCaptureToken } from '$lib/server/quick-capture-tokens.js';
import { checkIpRateLimit } from '$lib/server/ip-rate-limit.js';
import { buildCaptureDraft } from '$lib/utils/capture.js';

const captureInputSchema = z.object({
	input: z.string().trim().min(1).max(50_000),
	title: z.string().trim().max(500).optional(),
	url: z.string().trim().max(4_096).optional()
}).strict();

const noStoreHeaders = { 'Cache-Control': 'no-store' };

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

	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		return json({ error: 'Request body must be valid JSON' }, { status: 400, headers: noStoreHeaders });
	}
	const parsed = captureInputSchema.safeParse(raw);
	if (!parsed.success) {
		return json({ error: 'Input must contain between 1 and 50000 characters' }, { status: 400, headers: noStoreHeaders });
	}

	const draft = buildCaptureDraft({
		title: parsed.data.title,
		text: parsed.data.input,
		url: parsed.data.url
	});
	const crumb = createNote(db, userId, draft);
	return json(
		{ message: 'Crumb captured', crumb: { id: crumb.id, title: crumb.title } },
		{ status: 201, headers: noStoreHeaders }
	);
};
