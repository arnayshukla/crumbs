import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { tags } from '$lib/server/db/schema.js';

export const GET: RequestHandler = async () => {
	const allTags = await db.select().from(tags);
	return json(allTags);
};
