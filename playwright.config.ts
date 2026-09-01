import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? '4173');

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: 0,
	workers: process.env.CI ? 4 : undefined,
	reporter: 'html',
	globalSetup: './tests/e2e/global-setup.ts',
	use: {
		baseURL: `http://localhost:${port}`,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		serviceWorkers: 'block',
		launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
			? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
			: undefined
	},
	projects: [
		{
			name: 'auth-setup',
			testMatch: 'auth.spec.ts',
			fullyParallel: false,
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'app',
			testIgnore: 'auth.spec.ts',
			dependencies: ['auth-setup'],
			use: { ...devices['Desktop Chrome'] }
		}
	],
	webServer: {
		// The wipe runs here (before the server opens the database), not in
		// globalSetup: Playwright starts the webServer before globalSetup, so
		// deleting the SQLite files later would orphan the server's open
		// database onto a deleted inode. Tests that read the database file
		// directly (see linkUserToOAuth in admin-users.spec.ts) must see the
		// server's real database file.
		command: `rm -f data/test-crumbs.db data/test-crumbs.db-wal data/test-crumbs.db-shm data/test-crumbs.db-journal && corepack pnpm preview --port ${port}`,
		port,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		env: {
			DATABASE_URL: './data/test-crumbs.db',
			NODE_ENV: 'test'
		}
	}
});
