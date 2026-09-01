import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAdmin } from '$lib/server/api-utils.js';
import { stageInstanceRestore } from '$lib/server/archive.js';

export const POST: RequestHandler = async ({ request, ...event }) => {
	requireAdmin(event);
	const form = await request.formData();
	if (form.get('confirmation') !== 'RESTORE') throw error(400, 'Type RESTORE to confirm');
	const file = form.get('archive');
	if (!(file instanceof File)) throw error(400, 'Archive is required');
	try {
		return json(await stageInstanceRestore(file));
	} catch (cause) {
		throw error(400, cause instanceof Error ? cause.message : 'Invalid archive');
	}
};
