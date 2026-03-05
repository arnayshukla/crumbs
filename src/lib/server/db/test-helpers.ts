import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

/**
 * Create an in-memory SQLite database for testing.
 * Each test gets a fresh database.
 */
export function createTestDb() {
	const sqlite = new Database(':memory:');
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');

	// Create tables
	sqlite.exec(`
		CREATE TABLE users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			password_hash TEXT NOT NULL,
			created_at INTEGER NOT NULL
		);

		CREATE TABLE sessions (
			id TEXT PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES users(id),
			expires_at INTEGER NOT NULL
		);

		CREATE TABLE notes (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL DEFAULT '',
			content TEXT NOT NULL DEFAULT '',
			color TEXT NOT NULL DEFAULT 'default',
			pinned INTEGER NOT NULL DEFAULT 0,
			archived INTEGER NOT NULL DEFAULT 0,
			trashed INTEGER NOT NULL DEFAULT 0,
			trashed_at INTEGER,
			checklist_mode INTEGER NOT NULL DEFAULT 0,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL,
			version INTEGER NOT NULL DEFAULT 1
		);

		CREATE TABLE tags (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL
		);
		CREATE UNIQUE INDEX tags_name_unique ON tags(name);

		CREATE TABLE note_tags (
			note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
			tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE
		);

		CREATE TABLE attachments (
			id TEXT PRIMARY KEY,
			note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
			filename TEXT NOT NULL,
			mime_type TEXT NOT NULL,
			size INTEGER NOT NULL,
			path TEXT NOT NULL,
			created_at INTEGER NOT NULL
		);

		CREATE TABLE sync_log (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			note_id TEXT NOT NULL REFERENCES notes(id),
			operation TEXT NOT NULL,
			timestamp INTEGER NOT NULL,
			client_id TEXT NOT NULL
		);
	`);

	const db = drizzle(sqlite, { schema });
	return { db, sqlite };
}
