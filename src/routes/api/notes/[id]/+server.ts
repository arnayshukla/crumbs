import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { notes, noteTags, tags } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { extractTags } from '$lib/utils/tags.js';

export const GET: RequestHandler = async ({ params }) => {
	const note = await db.select().from(notes).where(eq(notes.id, params.id)).get();

	if (!note) {
		throw error(404, 'Note not found');
	}

	const tagRows = await db
		.select({ name: tags.name })
		.from(noteTags)
		.innerJoin(tags, eq(noteTags.tagId, tags.id))
		.where(eq(noteTags.noteId, note.id));

	return json({ ...note, tags: tagRows.map((t) => t.name) });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	const existing = await db.select().from(notes).where(eq(notes.id, params.id)).get();

	if (!existing) {
		throw error(404, 'Note not found');
	}

	const now = new Date();
	const updates: Record<string, unknown> = {
		updatedAt: now,
		version: existing.version + 1
	};

	if (body.title !== undefined) updates.title = body.title;
	if (body.content !== undefined) updates.content = body.content;
	if (body.color !== undefined) updates.color = body.color;
	if (body.pinned !== undefined) updates.pinned = body.pinned;
	if (body.archived !== undefined) updates.archived = body.archived;
	if (body.trashed !== undefined) {
		updates.trashed = body.trashed;
		updates.trashedAt = body.trashed ? now : null;
	}
	if (body.checklistMode !== undefined) updates.checklistMode = body.checklistMode;
	if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

	await db.update(notes).set(updates).where(eq(notes.id, params.id));

	const updated = await db.select().from(notes).where(eq(notes.id, params.id)).get();

	// Re-sync tags if content or title changed
	if (body.title !== undefined || body.content !== undefined) {
		const content = `${updated!.title} ${updated!.content}`;
		const extractedTags = extractTags(content);
		await syncNoteTags(params.id, extractedTags);
	}

	const tagRows = await db
		.select({ name: tags.name })
		.from(noteTags)
		.innerJoin(tags, eq(noteTags.tagId, tags.id))
		.where(eq(noteTags.noteId, params.id));

	return json({ ...updated, tags: tagRows.map((t) => t.name) });
};

export const DELETE: RequestHandler = async ({ params }) => {
	const existing = await db.select().from(notes).where(eq(notes.id, params.id)).get();

	if (!existing) {
		throw error(404, 'Note not found');
	}

	await db.delete(notes).where(eq(notes.id, params.id));
	return json({ success: true });
};

async function syncNoteTags(noteId: string, tagNames: string[]) {
	await db.delete(noteTags).where(eq(noteTags.noteId, noteId));

	for (const name of tagNames) {
		let tagRow = await db.select().from(tags).where(eq(tags.name, name)).get();
		if (!tagRow) {
			const result = await db.insert(tags).values({ name }).returning();
			tagRow = result[0];
		}
		await db.insert(noteTags).values({ noteId, tagId: tagRow.id });
	}
}
