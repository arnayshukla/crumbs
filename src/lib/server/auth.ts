import { db } from './db/index.js';
import { users, sessions } from './db/schema.js';
import { eq, lt } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function isSetupComplete(): Promise<boolean> {
	const user = await db.select().from(users).get();
	return !!user;
}

export async function setupUser(password: string): Promise<boolean> {
	const existing = await db.select().from(users).get();
	if (existing) return false; // Already set up

	const hash = await argon2.hash(password);
	await db.insert(users).values({
		passwordHash: hash,
		createdAt: new Date()
	});
	return true;
}

export async function verifyPassword(password: string): Promise<boolean> {
	const user = await db.select().from(users).get();
	if (!user) return false;
	return argon2.verify(user.passwordHash, password);
}

export async function createSession(): Promise<string> {
	const user = await db.select().from(users).get();
	if (!user) throw new Error('No user exists');

	const token = randomBytes(32).toString('hex');
	await db.insert(sessions).values({
		id: token,
		userId: user.id,
		expiresAt: new Date(Date.now() + SESSION_DURATION_MS)
	});
	return token;
}

export async function validateSession(token: string): Promise<boolean> {
	if (!token) return false;

	const session = await db.select().from(sessions).where(eq(sessions.id, token)).get();
	if (!session) return false;

	if (session.expiresAt < new Date()) {
		await db.delete(sessions).where(eq(sessions.id, token));
		return false;
	}

	return true;
}

export async function deleteSession(token: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, token));
}

export async function cleanExpiredSessions(): Promise<void> {
	await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
