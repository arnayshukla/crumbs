import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { notes, noteTags, tags } from '$lib/server/db/schema.js';
import { and, eq, like, or } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q')?.trim();

	if (!query) {
		return json([]);
	}

	const pattern = `%${query}%`;

	const results = await db
		.select()
		.from(notes)
		.where(
			and(
				eq(notes.trashed, false),
				or(like(notes.title, pattern), like(notes.content, pattern))
			)
		);

	// Also search by tag name
	const tagResults = await db
		.select({ noteId: noteTags.noteId })
		.from(noteTags)
		.innerJoin(tags, eq(noteTags.tagId, tags.id))
		.where(like(tags.name, pattern));

	const tagNoteIds = new Set(tagResults.map((r) => r.noteId));
	const allNoteIds = new Set(results.map((n) => n.id));

	// Fetch tag-matched notes not already in results
	const extraNoteIds = [...tagNoteIds].filter((id) => !allNoteIds.has(id));
	let extraNotes: typeof results = [];
	if (extraNoteIds.length > 0) {
		for (const id of extraNoteIds) {
			const note = await db
				.select()
				.from(notes)
				.where(and(eq(notes.id, id), eq(notes.trashed, false)))
				.get();
			if (note) extraNotes.push(note);
		}
	}

	const combined = [...results, ...extraNotes];

	// Attach tags to each note
	const withTags = await Promise.all(
		combined.map(async (note) => {
			const tagRows = await db
				.select({ name: tags.name })
				.from(noteTags)
				.innerJoin(tags, eq(noteTags.tagId, tags.id))
				.where(eq(noteTags.noteId, note.id));
			return { ...note, tags: tagRows.map((t) => t.name) };
		})
	);

	return json(withTags);
};
