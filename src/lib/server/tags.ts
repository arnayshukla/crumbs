import type { Db } from './db/index.js';
import { noteTags, tags, notes } from './db/schema.js';
import { eq, and, inArray, count, notInArray } from 'drizzle-orm';
import { extractTags, rewriteTag } from '$lib/utils/tags.js';
import { createSnapshot } from './versions-service.js';
import type { TagManagePreview } from '$lib/types/index.js';

/**
 * Batch fetch tags for multiple notes in a single query.
 * Returns a Map of noteId → tag names.
 */
export function fetchTagsForNotes(db: Db, noteIds: string[]): Map<string, string[]> {
	if (noteIds.length === 0) return new Map();

	const rows = db
		.select({ noteId: noteTags.noteId, name: tags.name })
		.from(noteTags)
		.innerJoin(tags, eq(noteTags.tagId, tags.id))
		.where(inArray(noteTags.noteId, noteIds))
		.all();

	const map = new Map<string, string[]>();
	for (const row of rows) {
		const existing = map.get(row.noteId);
		if (existing) {
			existing.push(row.name);
		} else {
			map.set(row.noteId, [row.name]);
		}
	}
	return map;
}

/**
 * Sync tags for a note: removes old associations, upserts tags, creates new associations.
 * Should be called within a transaction for atomicity.
 */
export function syncNoteTags(db: Db, noteId: string, tagNames: string[], userId: number) {
	db.delete(noteTags).where(eq(noteTags.noteId, noteId)).run();

	for (const name of tagNames) {
		let tagRow = db
			.select()
			.from(tags)
			.where(and(eq(tags.name, name), eq(tags.userId, userId)))
			.get();
		if (!tagRow) {
			const result = db.insert(tags).values({ name, userId }).returning().all();
			tagRow = result[0];
		}
		db.insert(noteTags).values({ noteId, tagId: tagRow.id }).run();
	}
	db.delete(tags)
		.where(
			and(
				eq(tags.userId, userId),
				notInArray(tags.id, db.select({ tagId: noteTags.tagId }).from(noteTags))
			)
		)
		.run();
}

export function listTagsWithUsage(db: Db, userId: number) {
	return db
		.select({ id: tags.id, name: tags.name, usageCount: count(noteTags.noteId) })
		.from(tags)
		.leftJoin(noteTags, eq(noteTags.tagId, tags.id))
		.where(eq(tags.userId, userId))
		.groupBy(tags.id)
		.orderBy(tags.name)
		.all();
}

export function previewTagChange(
	db: Db,
	userId: number,
	source: string,
	target?: string
): TagManagePreview {
	const normalized = source.toLowerCase();
	const owned = db
		.select({ id: notes.id, title: notes.title, content: notes.content })
		.from(notes)
		.where(eq(notes.userId, userId))
		.all();
	return {
		source: normalized,
		target,
		affected: owned
			.filter(
				(note) =>
					rewriteTag(`${note.title}\n${note.content}`, normalized, target) !==
					`${note.title}\n${note.content}`
			)
			.map(({ id, title }) => ({ id, title }))
	};
}

export function applyTagChange(
	db: Db,
	userId: number,
	source: string,
	target?: string
): TagManagePreview {
	const preview = previewTagChange(db, userId, source, target);
	const ids = new Set(preview.affected.map((note) => note.id));

	db.transaction((tx) => {
		const owned = tx
			.select()
			.from(notes)
			.where(eq(notes.userId, userId))
			.all()
			.filter((note) => ids.has(note.id));
		for (const note of owned) {
			const title = rewriteTag(note.title, source, target);
			const content = rewriteTag(note.content, source, target);
			createSnapshot(tx, note.id, note);
			tx.update(notes)
				.set({ title, content, updatedAt: new Date(), version: note.version + 1 })
				.where(eq(notes.id, note.id))
				.run();
			syncNoteTags(tx as Db, note.id, extractTags(`${title} ${content}`), userId);
		}

		// A tag can be left behind without associations after an older sync or a
		// deleted crumb. In that case there are no notes above to trigger
		// syncNoteTags, so remove the source row explicitly.
		const normalizedSource = source.toLowerCase();
		if (!target || target.toLowerCase() !== normalizedSource) {
			tx.delete(tags)
				.where(and(eq(tags.userId, userId), eq(tags.name, normalizedSource)))
				.run();
		}
	});

	return preview;
}
