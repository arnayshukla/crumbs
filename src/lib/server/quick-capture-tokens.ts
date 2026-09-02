import { createHash, randomBytes } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { Db } from './db/index.js';
import { quickCaptureTokens } from './db/schema.js';

const TOKEN_PREFIX = 'crumbs_capture_';

function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export function generateQuickCaptureToken(name: string, userId: number, database: Db) {
	const id = uuidv4();
	const token = `${TOKEN_PREFIX}${randomBytes(32).toString('hex')}`;
	const keyPrefix = token.slice(0, TOKEN_PREFIX.length + 6);

	database.insert(quickCaptureTokens).values({
		id,
		userId,
		name,
		keyHash: hashToken(token),
		keyPrefix,
		createdAt: new Date()
	}).run();

	return { id, token, name, keyPrefix };
}

export function validateQuickCaptureToken(token: string, database: Db): number | null {
	if (!token.startsWith(TOKEN_PREFIX)) return null;

	const row = database
		.select({ id: quickCaptureTokens.id, userId: quickCaptureTokens.userId })
		.from(quickCaptureTokens)
		.where(eq(quickCaptureTokens.keyHash, hashToken(token)))
		.get();
	if (!row) return null;

	database
		.update(quickCaptureTokens)
		.set({ lastUsedAt: new Date() })
		.where(eq(quickCaptureTokens.id, row.id))
		.run();
	return row.userId;
}

export function listQuickCaptureTokens(userId: number, database: Db) {
	return database
		.select({
			id: quickCaptureTokens.id,
			name: quickCaptureTokens.name,
			keyPrefix: quickCaptureTokens.keyPrefix,
			createdAt: quickCaptureTokens.createdAt,
			lastUsedAt: quickCaptureTokens.lastUsedAt
		})
		.from(quickCaptureTokens)
		.where(eq(quickCaptureTokens.userId, userId))
		.all();
}

export function revokeQuickCaptureToken(id: string, userId: number, database: Db): boolean {
	const result = database
		.delete(quickCaptureTokens)
		.where(and(eq(quickCaptureTokens.id, id), eq(quickCaptureTokens.userId, userId)))
		.run();
	return result.changes > 0;
}
