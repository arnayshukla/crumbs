import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { verifyPassword, createSession } from '$lib/server/auth.js';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const { password } = await request.json();

	if (!password) {
		throw error(400, 'Password is required');
	}

	const valid = await verifyPassword(password);
	if (!valid) {
		throw error(401, 'Invalid password');
	}

	const token = await createSession();
	cookies.set('session', token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 30 * 24 * 60 * 60 // 30 days
	});

	return json({ success: true });
};
