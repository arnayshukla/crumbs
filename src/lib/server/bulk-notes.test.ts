import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from './db/index.js';
import { createTestDb } from './db/test-helpers.js';
import { noteCollaborators, notes, users } from './db/schema.js';
import { applyBulkNoteAction, BulkNoteError } from './bulk-notes.js';
import { eq } from 'drizzle-orm';

let db: Db;

beforeEach(() => {
	db = createTestDb().db;
	db.insert(users).values([
		{ email: 'owner@test.com', displayName: 'Owner', role: 'admin', authProvider: 'password', createdAt: new Date() },
		{ email: 'collab@test.com', displayName: 'Collaborator', role: 'user', authProvider: 'password', createdAt: new Date() }
	]).run();
	for (const id of ['one', 'two']) {
		db.insert(notes).values({ id, userId: 1, title: id, content: '', createdAt: new Date(), updatedAt: new Date() }).run();
	}
});

describe('bulk note actions', () => {
	it('archives the complete selection', () => {
		const result = applyBulkNoteAction(db, 1, { action: 'archive', noteIds: ['one', 'two'] });
		expect(result.removedIds).toEqual(['one', 'two']);
		expect(db.select().from(notes).where(eq(notes.archived, true)).all()).toHaveLength(2);
	});

	it('rejects an owner-only action for a collaborator before writing', () => {
		db.insert(noteCollaborators).values({ noteId: 'two', userId: 2, addedBy: 1, addedAt: new Date() }).run();
		expect(() => applyBulkNoteAction(db, 2, { action: 'trash', noteIds: ['two'] })).toThrow(BulkNoteError);
		expect(db.select().from(notes).where(eq(notes.id, 'two')).get()?.trashed).toBe(false);
	});

	it('applies collaborator pin state without changing owner state', () => {
		db.insert(noteCollaborators).values({ noteId: 'two', userId: 2, addedBy: 1, addedAt: new Date() }).run();
		expect(applyBulkNoteAction(db, 2, { action: 'pin', noteIds: ['two'] }).updated[0].pinned).toBe(true);
		expect(db.select().from(notes).where(eq(notes.id, 'two')).get()?.pinned).toBe(false);
	});
});
