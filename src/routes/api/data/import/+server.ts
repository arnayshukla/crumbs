import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { getUserId } from '$lib/server/api-utils.js';
import { importPortableArchive } from '$lib/server/archive.js';

export const POST: RequestHandler = async ({ request, ...event }) => {
	const userId = getUserId(event);
	const form = await request.formData();
	const file = form.get('archive');
	if (!(file instanceof File)) throw error(400, 'Archive is required');
	try {
		return json(await importPortableArchive(db, userId, file));
	} catch (cause) {
		throw error(400, cause instanceof Error ? cause.message : 'Invalid archive');
	}
};
