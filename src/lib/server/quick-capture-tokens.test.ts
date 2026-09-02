import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from './db/index.js';
import { createTestDb } from './db/test-helpers.js';
import { users } from './db/schema.js';
import {
	generateQuickCaptureToken,
	listQuickCaptureTokens,
	revokeQuickCaptureToken,
	validateQuickCaptureToken
} from './quick-capture-tokens.js';

describe('quick capture tokens', () => {
	let db: Db;
	let userId: number;

	beforeEach(() => {
		({ db } = createTestDb());
		db.insert(users).values({ email: 'capture@example.com', displayName: 'Capture', createdAt: new Date() }).run();
		userId = 1;
	});

	it('generates a strong token and only lists its safe metadata', () => {
		const created = generateQuickCaptureToken('My iPhone', userId, db);
		expect(created.token).toMatch(/^crumbs_capture_[a-f0-9]{64}$/);

		const [listed] = listQuickCaptureTokens(userId, db);
		expect(listed).toMatchObject({ id: created.id, name: 'My iPhone', keyPrefix: created.keyPrefix });
		expect(listed).not.toHaveProperty('keyHash');
		expect(listed).not.toHaveProperty('token');
	});

	it('validates only capture tokens and records their use', () => {
		const { token } = generateQuickCaptureToken('My iPhone', userId, db);
		expect(validateQuickCaptureToken(token, db)).toBe(userId);
		expect(listQuickCaptureTokens(userId, db)[0]?.lastUsedAt).toBeInstanceOf(Date);
		expect(validateQuickCaptureToken('crumbs_not-a-capture-token', db)).toBeNull();
	});

	it('revokes a token without allowing cross-account revocation', () => {
		const { id, token } = generateQuickCaptureToken('My iPhone', userId, db);
		expect(revokeQuickCaptureToken(id, 999, db)).toBe(false);
		expect(validateQuickCaptureToken(token, db)).toBe(userId);
		expect(revokeQuickCaptureToken(id, userId, db)).toBe(true);
		expect(validateQuickCaptureToken(token, db)).toBeNull();
	});
});
