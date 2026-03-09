import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getUserId } from '$lib/server/api-utils.js';
import { verifyPassword, deleteUser, deleteSession, getUser } from '$lib/server/auth.js';

export const DELETE: RequestHandler = async ({ request, cookies, ...event }) => {
	const userId = getUserId(event);
	const user = getUser(userId);
	if (!user) throw error(404, 'User not found');

	const body = await request.json();

	// OAuth users don't have passwords — allow deletion without password
	if (user.authProvider === 'password') {
		if (!body.password) throw error(400, 'Password is required');
		const verified = await verifyPassword(user.email, body.password);
		if (!verified) throw error(401, 'Invalid password');
	}

	// Delete user and all associated data
	await deleteUser(userId);

	// Clear session cookie
	const token = cookies.get('session');
	if (token) {
		await deleteSession(token);
		cookies.delete('session', { path: '/' });
	}

	return json({ success: true });
};
