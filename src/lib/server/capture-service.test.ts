import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { captureRequests, notes, users } from './db/schema.js';
import { createTestDb } from './db/test-helpers.js';
import { captureCrumb, CaptureValidationError } from './capture-service.js';

describe('capture service', () => {
	it('returns the original crumb when an idempotency key is retried', async () => {
		const { db } = createTestDb({ seedUser: true });
		const user = db.select().from(users).get()!;
		const input = {
			input: 'Remember this',
			title: 'Thought',
			images: [],
			idempotencyKey: 'request-1'
		};

		const first = await captureCrumb(db, user.id, input);
		const retry = await captureCrumb(db, user.id, input);

		expect(first.replayed).toBe(false);
		expect(retry).toMatchObject({ replayed: true, crumb: first.crumb });
		expect(db.select().from(notes).all()).toHaveLength(1);
		expect(db.select().from(captureRequests).where(eq(captureRequests.noteId, first.crumb.id)).all()).toHaveLength(1);
	});

	it('creates a searchable voice crumb without storing audio', async () => {
		const { db } = createTestDb({ seedUser: true });
		const user = db.select().from(users).get()!;
		const result = await captureCrumb(db, user.id, {
			input: 'Call Sam after lunch',
			title: 'Voice note',
			mode: 'voice',
			images: []
		});
		const note = db.select().from(notes).where(eq(notes.id, result.crumb.id)).get();
		expect(note?.content).toContain('Call Sam after lunch');
		expect(note?.content).toContain('#voice');
		expect(note?.content).not.toContain('#text');
	});

	it('rejects empty captures', async () => {
		const { db } = createTestDb({ seedUser: true });
		const user = db.select().from(users).get()!;
		await expect(captureCrumb(db, user.id, { input: '', images: [] }))
			.rejects.toBeInstanceOf(CaptureValidationError);
	});
});
