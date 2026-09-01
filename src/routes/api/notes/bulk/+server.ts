import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { z } from 'zod';
import { db } from '$lib/server/db/index.js';
import { getUserId } from '$lib/server/api-utils.js';
import { applyBulkNoteAction, BulkNoteError } from '$lib/server/bulk-notes.js';

const noteIds = z.array(z.string().min(1)).min(1).max(200);
const schema = z.discriminatedUnion('action', [
	z.object({ action: z.enum(['pin', 'unpin', 'archive', 'unarchive', 'trash', 'restore', 'delete']), noteIds }),
	z.object({ action: z.literal('color'), noteIds, color: z.enum(['default', 'coral', 'peach', 'sand', 'mint', 'sage', 'fog', 'storm', 'dusk', 'blossom', 'clay', 'chalk']) })
]);

export const POST: RequestHandler = async ({ request, ...event }) => {
	const userId = getUserId(event);
	const parsed = schema.safeParse(await request.json());
	if (!parsed.success) throw error(400, 'Invalid bulk operation');
	try {
		return json(applyBulkNoteAction(db, userId, parsed.data));
	} catch (cause) {
		if (cause instanceof BulkNoteError) throw error(cause.status, cause.message);
		throw cause;
	}
};
