import type { RequestHandler } from './$types.js';
import { requireAdmin } from '$lib/server/api-utils.js';
import { createInstanceArchive, nodeStreamResponse } from '$lib/server/archive.js';

export const GET: RequestHandler = async (event) => {
	requireAdmin(event);
	const date = new Date().toISOString().slice(0, 10);
	return nodeStreamResponse(await createInstanceArchive(), `crumbs-instance-${date}.zip`);
};
