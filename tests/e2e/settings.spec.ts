import { test, expect } from './helpers/fixtures.js';

test.describe('Settings — Preferences', () => {
	test('Scenario: Preferences tab is visible in settings nav', async ({
		authenticatedPage: page
	}) => {
		// When the user navigates to settings
		await page.goto('/settings');

		// Then the Preferences nav link is visible
		await expect(page.getByTestId('settings-nav-preferences')).toBeVisible();
	});

	test('Scenario: Default note mode change applies to new notes', async ({
		authenticatedPage: page
	}) => {
		// Given the user sets default note mode to Markdown
		await page.goto('/settings/preferences');
		const putResponse = page.waitForResponse((res) => res.url().includes('/api/preferences') && res.request().method() === 'PUT');
		await page.getByTestId('pref-mode-markdown').click();
		await putResponse;

		// When the user creates a new note
		await page.goto('/');
		await page.getByTestId('new-note-btn').click();

		// Then the note editor opens in markdown mode (textarea visible)
		await expect(page.getByTestId('note-content-input')).toBeVisible();
	});

	test('Scenario: Footer toggle hides and shows footer', async ({
		authenticatedPage: page
	}) => {
		// Given the footer is visible
		await page.goto('/');
		await expect(page.getByTestId('app-footer')).toBeVisible();

		// When the user enables the hide footer preference
		await page.goto('/settings/preferences');
		await page.getByTestId('pref-hide-footer').check();

		// Then the footer is hidden
		await page.goto('/');
		await expect(page.getByTestId('app-footer')).not.toBeVisible();

		// When the user disables the hide footer preference
		await page.goto('/settings/preferences');
		await page.getByTestId('pref-hide-footer').uncheck();

		// Then the footer is visible again
		await page.goto('/');
		await expect(page.getByTestId('app-footer')).toBeVisible();
	});

	test('Scenario: Preferences persist across page reload', async ({
		authenticatedPage: page
	}) => {
		// Given the user changes default note mode to Markdown
		await page.goto('/settings/preferences');
		await page.getByTestId('pref-mode-markdown').click();

		// When the page is reloaded
		await page.reload();

		// Then the Markdown button is still selected (has primary styling)
		const mdBtn = page.getByTestId('pref-mode-markdown');
		await expect(mdBtn).toHaveClass(/font-medium/);
	});
});

test.describe('Settings — API Key Management', () => {
	test('Scenario: Created API key appears in the keys list', async ({
		authenticatedPage: page
	}) => {
		// When the user navigates to the MCP settings and creates an API key
		await page.goto('/settings/mcp');
		await page.getByTestId('api-key-name-input').fill('Settings Test Key');
		await page.getByTestId('create-api-key-btn').click();

		// Then the key is shown once for copying
		await expect(page.getByTestId('created-key-display')).toBeVisible();
		const keyValue = await page.getByTestId('created-key-value').textContent();
		expect(keyValue).toMatch(/^crumbs_/);

		// And it appears in the keys list
		const keyItem = page.getByTestId('api-key-item').filter({ hasText: 'Settings Test Key' });
		await expect(keyItem).toBeVisible();
	});

	test('Scenario: Revoked API key disappears from the keys list', async ({
		authenticatedPage: page
	}) => {
		// Given an API key exists
		await page.goto('/settings/mcp');
		await page.getByTestId('api-key-name-input').fill('Revoke Me');
		await page.getByTestId('create-api-key-btn').click();
		await expect(page.getByTestId('created-key-display')).toBeVisible();

		const keyItem = page.getByTestId('api-key-item').filter({ hasText: 'Revoke Me' });
		await expect(keyItem).toBeVisible();

		// When the user revokes the key
		await keyItem.getByTestId('delete-api-key-btn').click();
		await keyItem.getByTestId('confirm-delete-btn').click();

		// Then the key is removed from the list
		await expect(keyItem).not.toBeVisible();
	});

	test('Scenario: Settings page is accessible from sidebar', async ({
		authenticatedPage: page
	}) => {
		// Given the user is on the main page
		// When the user clicks the Settings link in the sidebar
		await page.getByTestId('settings-link').click();

		// Then the settings page redirects to preferences
		await expect(page).toHaveURL('/settings/preferences');
		await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
	});

	test('Scenario: Settings subpages are navigable', async ({
		authenticatedPage: page
	}) => {
		// Given the user is on the settings page
		await page.goto('/settings');

		// When the user clicks the API nav link
		await page.getByRole('link', { name: 'API' }).click();

		// Then the API settings page is shown
		await expect(page).toHaveURL('/settings/mcp');
		await expect(page.getByRole('heading', { name: 'API Keys' })).toBeVisible();

		// When the user clicks back to Profile
		await page.getByRole('link', { name: 'Profile' }).click();
		await expect(page).toHaveURL('/settings/profile');
	});
});
