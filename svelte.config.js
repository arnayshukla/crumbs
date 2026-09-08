import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			out: 'build'
		}),
		// Quick Capture intentionally accepts capture-token-authenticated multipart
		// requests from native share sheets. hooks.server.ts preserves the default
		// same-origin protection for every other form submission.
		csrf: {
			trustedOrigins: ['*']
		},
		serviceWorker: {
			register: false
		}
	}
};

export default config;
