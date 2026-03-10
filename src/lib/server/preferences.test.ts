import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './db/test-helpers.js';
import type { Db } from './db/index.js';
import { getPreferences, upsertPreferences } from './preferences.js';

let db: Db;
const USER_ID = 1;

beforeEach(() => {
	const testDb = createTestDb({ seedUser: true });
	db = testDb.db;
});

describe('getPreferences', () => {
	it('should return empty object for user with no preferences', () => {
		const prefs = getPreferences(db, USER_ID);
		expect(prefs).toEqual({});
	});
});

describe('upsertPreferences', () => {
	it('should insert new preferences', () => {
		const result = upsertPreferences(db, USER_ID, {
			defaultNoteMode: 'markdown',
			hideFooter: 'true'
		});
		expect(result).toEqual({
			defaultNoteMode: 'markdown',
			hideFooter: 'true'
		});
	});

	it('should update existing preferences', () => {
		upsertPreferences(db, USER_ID, { defaultNoteMode: 'markdown' });
		const result = upsertPreferences(db, USER_ID, { defaultNoteMode: 'richtext' });
		expect(result.defaultNoteMode).toBe('richtext');
	});

	it('should handle partial updates without affecting other keys', () => {
		upsertPreferences(db, USER_ID, {
			defaultNoteMode: 'markdown',
			hideFooter: 'true'
		});
		const result = upsertPreferences(db, USER_ID, { hideFooter: 'false' });
		expect(result).toEqual({
			defaultNoteMode: 'markdown',
			hideFooter: 'false'
		});
	});

	it('should keep preferences isolated between users', () => {
		// Create a second user
		db.run(
			/* sql */ `INSERT INTO users (email, display_name, role, auth_provider, created_at) VALUES ('user2@test.com', 'User 2', 'user', 'password', ${Date.now()})`
		);
		upsertPreferences(db, USER_ID, { defaultNoteMode: 'markdown' });
		upsertPreferences(db, 2, { defaultNoteMode: 'richtext' });

		expect(getPreferences(db, USER_ID).defaultNoteMode).toBe('markdown');
		expect(getPreferences(db, 2).defaultNoteMode).toBe('richtext');
	});
});
