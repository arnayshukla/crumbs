import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { notes, noteTags, tags } from '$lib/server/db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { extractTags } from '$lib/utils/tags.js';

export const GET: RequestHandler = async ({ url }) => {
	const filter = url.searchParams.get('filter') || 'all';

	let conditions;
	switch (filter) {
		case 'archived':
			conditions = and(eq(notes.archived, true), eq(notes.trashed, false));
			break;
		case 'trashed':
			conditions = eq(notes.trashed, true);
			break;
		default:
			conditions = and(eq(notes.archived, false), eq(notes.trashed, false));
	}

	const result = await db
		.select()
		.from(notes)
		.where(conditions)
		.orderBy(desc(notes.pinned), desc(notes.updatedAt));

	// Fetch tags for each note
	const notesWithTags = await Promise.all(
		result.map(async (note) => {
			const tagRows = await db
				.select({ name: tags.name })
				.from(noteTags)
				.innerJoin(tags, eq(noteTags.tagId, tags.id))
				.where(eq(noteTags.noteId, note.id));
			return { ...note, tags: tagRows.map((t) => t.name) };
		})
	);

	return json(notesWithTags);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const now = new Date();
	const id = body.id || uuidv4();

	const newNote = {
		id,
		title: body.title || '',
		content: body.content || '',
		color: body.color || 'default',
		pinned: body.pinned || false,
		archived: false,
		trashed: false,
		trashedAt: null,
		checklistMode: body.checklistMode || false,
		sortOrder: body.sortOrder || 0,
		createdAt: now,
		updatedAt: now,
		version: 1
	};

	await db.insert(notes).values(newNote);

	// Extract and save tags
	const content = `${newNote.title} ${newNote.content}`;
	const extractedTags = extractTags(content);
	await syncNoteTags(id, extractedTags);

	return json({ ...newNote, tags: extractedTags }, { status: 201 });
};

async function syncNoteTags(noteId: string, tagNames: string[]) {
	// Remove existing tag associations
	await db.delete(noteTags).where(eq(noteTags.noteId, noteId));

	for (const name of tagNames) {
		// Upsert tag
		let tagRow = await db.select().from(tags).where(eq(tags.name, name)).get();
		if (!tagRow) {
			const result = await db.insert(tags).values({ name }).returning();
			tagRow = result[0];
		}
		await db.insert(noteTags).values({ noteId, tagId: tagRow.id });
	}
}
