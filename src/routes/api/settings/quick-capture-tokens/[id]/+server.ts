import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { getUserId } from '$lib/server/api-utils.js';
import { revokeQuickCaptureToken } from '$lib/server/quick-capture-tokens.js';

export const DELETE: RequestHandler = async ({ params, ...event }) => {
	const userId = getUserId(event);
	if (!revokeQuickCaptureToken(params.id, userId, db)) throw error(404, 'Capture token not found');
	return json({ success: true });
};
