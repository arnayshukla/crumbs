import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { getUserId } from '$lib/server/api-utils.js';
import {
	generateQuickCaptureToken,
	listQuickCaptureTokens
} from '$lib/server/quick-capture-tokens.js';

const createTokenSchema = z.object({
	name: z.string().trim().min(1).max(80)
}).strict();
const noStoreHeaders = { 'Cache-Control': 'no-store' };

export const GET: RequestHandler = async (event) => {
	const userId = getUserId(event);
	return json(listQuickCaptureTokens(userId, db), { headers: noStoreHeaders });
};

export const POST: RequestHandler = async ({ request, ...event }) => {
	const userId = getUserId(event);
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		return json({ error: 'Request body must be valid JSON' }, { status: 400, headers: noStoreHeaders });
	}
	const parsed = createTokenSchema.safeParse(raw);
	if (!parsed.success) return json({ error: 'Name must be between 1 and 80 characters' }, { status: 400, headers: noStoreHeaders });

	return json(generateQuickCaptureToken(parsed.data.name, userId, db), { status: 201, headers: noStoreHeaders });
};
