import { test as base, expect, type Page } from '@playwright/test';

const TEST_PASSWORD = 'testpassword123';

/**
 * Extended test fixture that handles setup/auth.
 */
export const test = base.extend<{ authenticatedPage: Page }>({
	authenticatedPage: async ({ page }, use) => {
		// Setup: create user and login
		await setupAndLogin(page);
		await use(page);
	}
});

export async function setupAndLogin(page: Page) {
	await page.goto('/');

	const url = page.url();
	if (url.includes('/setup')) {
		// First-time setup - may race with other workers
		await page.getByTestId('password-input').fill(TEST_PASSWORD);
		await page.getByTestId('confirm-password-input').fill(TEST_PASSWORD);
		await page.getByTestId('setup-btn').click();

		// Wait for either redirect to main page or an error (another worker completed setup first)
		try {
			await page.waitForURL('/', { timeout: 5000 });
		} catch {
			// Setup was completed by another worker - go to login instead
			await page.goto('/login');
			await page.getByTestId('password-input').fill(TEST_PASSWORD);
			await page.getByTestId('login-btn').click();
			await page.waitForURL('/');
		}
	} else if (url.includes('/login')) {
		// Login
		await page.getByTestId('password-input').fill(TEST_PASSWORD);
		await page.getByTestId('login-btn').click();
		await page.waitForURL('/');
	}
	// else: already on main page (session still valid)
}

export { expect };
