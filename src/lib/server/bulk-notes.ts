import type { Db } from './db/index.js';
import { notes, noteUserState } from './db/schema.js';
import { and, eq, inArray } from 'drizzle-orm';
import { canAccessNote } from './api-utils.js';
import { createSnapshot } from './versions-service.js';
import { getNote } from './notes-service.js';
import type { BulkNoteAction, Note } from '$lib/types/index.js';

export class BulkNoteError extends Error {
	constructor(
		message: string,
		readonly status: 400 | 403 | 404 | 409
	) {
		super(message);
	}
}

export interface BulkNoteResult {
	updated: Note[];
	removedIds: string[];
}

export function applyBulkNoteAction(db: Db, userId: number, input: BulkNoteAction): BulkNoteResult {
	const noteIds = [...new Set(input.noteIds)];
	if (noteIds.length === 0 || noteIds.length > 200) throw new BulkNoteError('Select between 1 and 200 crumbs', 400);

	const access = noteIds.map((id) => ({ id, ...canAccessNote(db, id, userId) }));
	if (access.some((item) => !item.canAccess)) throw new BulkNoteError('One or more crumbs were not found', 404);
	if (['trash', 'restore', 'delete'].includes(input.action) && access.some((item) => !item.isOwner)) {
		throw new BulkNoteError('This action requires ownership of every selected crumb', 403);
	}

	const removedIds: string[] = [];
	db.transaction((tx) => {
		for (const item of access) {
			const note = tx.select().from(notes).where(eq(notes.id, item.id)).get();
			if (!note) throw new BulkNoteError('A selected crumb changed during the operation', 409);

			switch (input.action) {
				case 'delete':
					tx.delete(notes).where(and(eq(notes.id, item.id), eq(notes.userId, userId))).run();
					removedIds.push(item.id);
					break;
				case 'trash':
				case 'restore':
					tx.update(notes)
						.set({ trashed: input.action === 'trash', trashedAt: input.action === 'trash' ? new Date() : null, updatedAt: new Date(), version: note.version + 1 })
						.where(eq(notes.id, item.id))
						.run();
					if (input.action === 'trash') removedIds.push(item.id);
					break;
				case 'color':
					createSnapshot(tx, item.id, note);
					tx.update(notes).set({ color: input.color, updatedAt: new Date(), version: note.version + 1 }).where(eq(notes.id, item.id)).run();
					break;
				case 'pin':
				case 'unpin':
				case 'archive':
				case 'unarchive': {
					const field = input.action === 'pin' || input.action === 'unpin' ? 'pinned' : 'archived';
					const value = input.action === 'pin' || input.action === 'archive';
					if (item.isOwner) {
						tx.update(notes).set({ [field]: value, updatedAt: new Date(), version: note.version + 1 }).where(eq(notes.id, item.id)).run();
					} else {
						const existing = tx.select().from(noteUserState).where(and(eq(noteUserState.noteId, item.id), eq(noteUserState.userId, userId))).get();
						if (existing) tx.update(noteUserState).set({ [field]: value }).where(and(eq(noteUserState.noteId, item.id), eq(noteUserState.userId, userId))).run();
						else tx.insert(noteUserState).values({ noteId: item.id, userId, pinned: field === 'pinned' ? value : false, archived: field === 'archived' ? value : false, sortOrder: 0 }).run();
					}
					if (input.action === 'archive') removedIds.push(item.id);
					break;
				}
				default: {
					const exhaustive: never = input;
					throw new BulkNoteError(`Unsupported bulk action: ${String(exhaustive)}`, 400);
				}
			}
		}
	});

	const updated = noteIds
		.filter((id) => !removedIds.includes(id) || input.action === 'restore')
		.map((id) => getNote(db, userId, id))
		.filter((note): note is NonNullable<typeof note> => note !== null) as Note[];
	return { updated, removedIds };
}
