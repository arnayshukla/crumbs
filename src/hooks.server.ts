import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { validateSession, isSetupComplete } from '$lib/server/auth.js';

const PUBLIC_PATHS = ['/login', '/setup', '/api/auth/login', '/api/auth/setup'];

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	// Allow public paths
	if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
		return resolve(event);
	}

	// Check if setup is complete
	const setupDone = await isSetupComplete();
	if (!setupDone) {
		if (pathname !== '/setup') {
			throw redirect(302, '/setup');
		}
		return resolve(event);
	}

	// Validate session
	const sessionToken = event.cookies.get('session');
	if (!sessionToken || !(await validateSession(sessionToken))) {
		if (pathname.startsWith('/api/')) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		throw redirect(302, '/login');
	}

	return resolve(event);
};
