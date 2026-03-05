import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { setupUser, createSession, isSetupComplete } from '$lib/server/auth.js';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const alreadySetup = await isSetupComplete();
	if (alreadySetup) {
		throw error(400, 'Setup already completed');
	}

	const { password } = await request.json();

	if (!password || password.length < 8) {
		throw error(400, 'Password must be at least 8 characters');
	}

	const success = await setupUser(password);
	if (!success) {
		throw error(500, 'Failed to create user');
	}

	const token = await createSession();
	cookies.set('session', token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 30 * 24 * 60 * 60
	});

	return json({ success: true }, { status: 201 });
};
