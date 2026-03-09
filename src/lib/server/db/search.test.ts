import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './test-helpers.js';
import { notes, tags, noteTags } from './schema.js';
import { and, eq, like, or } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from './schema.js';

let db: BetterSQLite3Database<typeof schema>;

beforeEach(async () => {
	const testDb = createTestDb({ seedUser: true });
	db = testDb.db;

	const now = new Date();
	await db.insert(notes).values([
		{ id: 'n1', userId: 1, title: 'Shopping List', content: 'Buy milk and eggs', createdAt: now, updatedAt: now },
		{ id: 'n2', userId: 1, title: 'Work Notes', content: 'Meeting at 3pm #work', createdAt: now, updatedAt: now },
		{ id: 'n3', userId: 1, title: 'Recipe', content: 'Pasta with tomato sauce', createdAt: now, updatedAt: now },
		{ id: 'n4', userId: 1, title: 'Trashed', content: 'Should not appear', trashed: true, createdAt: now, updatedAt: now }
	]);

	const [workTag] = await db.insert(tags).values({ userId: 1, name: 'work' }).returning();
	await db.insert(noteTags).values({ noteId: 'n2', tagId: workTag.id });
});

describe('Search', () => {
	it('should search by title', async () => {
		const pattern = '%shopping%';
		const results = await db
			.select()
			.from(notes)
			.where(and(eq(notes.trashed, false), like(notes.title, pattern)));

		expect(results).toHaveLength(1);
		expect(results[0].id).toBe('n1');
	});

	it('should search by content', async () => {
		const pattern = '%tomato%';
		const results = await db
			.select()
			.from(notes)
			.where(and(eq(notes.trashed, false), like(notes.content, pattern)));

		expect(results).toHaveLength(1);
		expect(results[0].id).toBe('n3');
	});

	it('should search across title and content', async () => {
		const pattern = '%milk%';
		const results = await db
			.select()
			.from(notes)
			.where(
				and(
					eq(notes.trashed, false),
					or(like(notes.title, pattern), like(notes.content, pattern))
				)
			);

		expect(results).toHaveLength(1);
		expect(results[0].id).toBe('n1');
	});

	it('should not include trashed notes', async () => {
		const pattern = '%should not%';
		const results = await db
			.select()
			.from(notes)
			.where(
				and(
					eq(notes.trashed, false),
					or(like(notes.title, pattern), like(notes.content, pattern))
				)
			);

		expect(results).toHaveLength(0);
	});

	it('should return empty for no matches', async () => {
		const pattern = '%nonexistent%';
		const results = await db
			.select()
			.from(notes)
			.where(
				and(
					eq(notes.trashed, false),
					or(like(notes.title, pattern), like(notes.content, pattern))
				)
			);

		expect(results).toHaveLength(0);
	});

	it('should be case-insensitive with LIKE', async () => {
		const pattern = '%SHOPPING%';
		const results = await db
			.select()
			.from(notes)
			.where(and(eq(notes.trashed, false), like(notes.title, pattern)));

		// SQLite LIKE is case-insensitive for ASCII by default
		expect(results).toHaveLength(1);
	});

	it('should search by tag name', async () => {
		const tagResults = await db
			.select({ noteId: noteTags.noteId })
			.from(noteTags)
			.innerJoin(tags, eq(noteTags.tagId, tags.id))
			.where(like(tags.name, '%work%'));

		expect(tagResults).toHaveLength(1);
		expect(tagResults[0].noteId).toBe('n2');
	});
});
