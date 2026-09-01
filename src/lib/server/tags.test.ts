import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './db/test-helpers.js';
import { notes, tags, noteTags, users } from './db/schema.js';
import { eq } from 'drizzle-orm';
import type { Db } from './db/index.js';
import { applyTagChange, fetchTagsForNotes, listTagsWithUsage, previewTagChange, syncNoteTags } from './tags.js';

let db: Db;
const USER_ID = 1;

function seedUser() {
	db.insert(users)
		.values({ email: 'test@test.com', displayName: 'Test', role: 'admin', authProvider: 'password', createdAt: new Date() })
		.run();
}

function seedNote(id: string) {
	db.insert(notes)
		.values({ id, userId: USER_ID, title: '', content: '', createdAt: new Date(), updatedAt: new Date() })
		.run();
}

beforeEach(() => {
	const testDb = createTestDb();
	db = testDb.db;
	seedUser();
});

describe('syncNoteTags', () => {
	it('should create new tags and associations', () => {
		seedNote('n1');
		syncNoteTags(db, 'n1', ['todo', 'urgent'], USER_ID);

		const tagRows = db.select().from(tags).all();
		expect(tagRows).toHaveLength(2);

		const associations = db.select().from(noteTags).all();
		expect(associations).toHaveLength(2);
	});

	it('should remove old associations and add new ones', () => {
		seedNote('n1');
		syncNoteTags(db, 'n1', ['old-tag'], USER_ID);
		syncNoteTags(db, 'n1', ['new-tag'], USER_ID);

		const map = fetchTagsForNotes(db, ['n1']);
		expect(map.get('n1')).toEqual(['new-tag']);
	});

	it('should handle empty tag list (removes all)', () => {
		seedNote('n1');
		syncNoteTags(db, 'n1', ['tag1', 'tag2'], USER_ID);
		syncNoteTags(db, 'n1', [], USER_ID);

		const associations = db.select().from(noteTags).where(eq(noteTags.noteId, 'n1')).all();
		expect(associations).toHaveLength(0);
	});

	it('should deduplicate existing tags', () => {
		seedNote('n1');
		seedNote('n2');
		syncNoteTags(db, 'n1', ['shared-tag'], USER_ID);
		syncNoteTags(db, 'n2', ['shared-tag'], USER_ID);

		// Should reuse the same tag row
		const tagRows = db.select().from(tags).all();
		expect(tagRows).toHaveLength(1);
	});
});

describe('fetchTagsForNotes', () => {
	it('should return Map of noteId to tag names', () => {
		seedNote('n1');
		seedNote('n2');
		syncNoteTags(db, 'n1', ['alpha', 'beta'], USER_ID);
		syncNoteTags(db, 'n2', ['gamma'], USER_ID);

		const map = fetchTagsForNotes(db, ['n1', 'n2']);
		expect(map.get('n1')).toHaveLength(2);
		expect(map.get('n1')).toContain('alpha');
		expect(map.get('n1')).toContain('beta');
		expect(map.get('n2')).toEqual(['gamma']);
	});

	it('should return empty map for empty noteIds', () => {
		const map = fetchTagsForNotes(db, []);
		expect(map.size).toBe(0);
	});
});

describe('tag management', () => {
	it('previews and renames tags only in owned crumbs', () => {
		seedNote('n1');
		db.update(notes).set({ title: '#work', content: 'Plan #work and `#work`' }).where(eq(notes.id, 'n1')).run();
		syncNoteTags(db, 'n1', ['work'], USER_ID);
		expect(previewTagChange(db, USER_ID, 'work', 'office').affected).toHaveLength(1);
		applyTagChange(db, USER_ID, 'work', 'office');
		const note = db.select().from(notes).where(eq(notes.id, 'n1')).get()!;
		expect(note.title).toBe('#office');
		expect(note.content).toBe('Plan #office and `#work`');
		expect(listTagsWithUsage(db, USER_ID)).toMatchObject([{ name: 'office', usageCount: 1 }]);
	});

	it('deletes the token while retaining crumb content', () => {
		seedNote('n1');
		db.update(notes).set({ content: 'Plan #work today' }).where(eq(notes.id, 'n1')).run();
		syncNoteTags(db, 'n1', ['work'], USER_ID);
		applyTagChange(db, USER_ID, 'work');
		expect(db.select().from(notes).where(eq(notes.id, 'n1')).get()?.content).toBe('Plan today');
	});

	it('deletes an orphaned tag with no associated crumbs', () => {
		db.insert(tags).values({ name: 'orphaned', userId: USER_ID }).run();
		expect(listTagsWithUsage(db, USER_ID)).toMatchObject([
			{ name: 'orphaned', usageCount: 0 }
		]);

		applyTagChange(db, USER_ID, 'orphaned');

		expect(listTagsWithUsage(db, USER_ID)).toEqual([]);
	});
});
