import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { processSyncPush, getChangesSince } from '$lib/sync/server.js';
import { fetchTagsForNotes } from '$lib/server/tags.js';

export const POST: RequestHandler = async ({ request }) => {
	const { changes } = await request.json();

	if (!Array.isArray(changes)) {
		return json({ error: 'Invalid changes' }, { status: 400 });
	}

	await processSyncPush(changes);
	return json({ success: true });
};

export const GET: RequestHandler = async ({ url }) => {
	const since = parseInt(url.searchParams.get('since') || '0', 10);
	const changes = await getChangesSince(since);

	const tagMap = fetchTagsForNotes(changes.map((n) => n.id));
	const changesWithTags = changes.map((note) => ({
		...note,
		tags: tagMap.get(note.id) ?? []
	}));

	return json(changesWithTags);
};
