import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { getUserId } from '$lib/server/api-utils.js';
import { listTagsWithUsage, previewTagChange, applyTagChange } from '$lib/server/tags.js';
import { z } from 'zod';

const tagName = z.string().trim().toLowerCase().regex(/^[\w-]+$/).max(64);
const requestSchema = z.discriminatedUnion('action', [
	z.object({
		action: z.literal('preview'),
		operation: z.enum(['rename', 'delete']),
		source: tagName,
		target: tagName.optional()
	}),
	z.object({ action: z.literal('rename'), source: tagName, target: tagName }),
	z.object({ action: z.literal('delete'), source: tagName })
]);

export const GET: RequestHandler = async (event) => {
	const userId = getUserId(event);
	return json(listTagsWithUsage(db, userId));
};

export const POST: RequestHandler = async ({ request, ...event }) => {
	const userId = getUserId(event);
	const parsed = requestSchema.safeParse(await request.json());
	if (!parsed.success) throw error(400, 'Invalid tag operation');

	if (parsed.data.action === 'preview') {
		if (parsed.data.operation === 'rename' && !parsed.data.target) {
			throw error(400, 'Target is required');
		}
		return json(
			previewTagChange(
				db,
				userId,
				parsed.data.source,
				parsed.data.operation === 'rename' ? parsed.data.target : undefined
			)
		);
	}
	return json({
		preview: applyTagChange(
			db,
			userId,
			parsed.data.source,
			parsed.data.action === 'rename' ? parsed.data.target : undefined
		),
		tags: listTagsWithUsage(db, userId)
	});
};
