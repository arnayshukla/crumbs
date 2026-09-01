import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { getUserId } from '$lib/server/api-utils.js';
import { createPortableArchive, nodeStreamResponse } from '$lib/server/archive.js';

export const GET: RequestHandler = async (event) => {
	const userId = getUserId(event);
	const date = new Date().toISOString().slice(0, 10);
	return nodeStreamResponse(createPortableArchive(db, userId), `crumbs-export-${date}.zip`);
};
