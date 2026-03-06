import { test, expect } from './helpers/fixtures.js';

test.describe('Offline Support', () => {
	test('Scenario: Sync status is visible to the user', async ({ authenticatedPage: page }) => {
		// Given the user is authenticated
		// Then the sync status indicator is displayed
		await expect(page.getByTestId('sync-indicator')).toBeVisible();
	});

	test('Scenario: Created note is immediately visible in the notes list', async ({ authenticatedPage: page }) => {
		// When the user creates a note titled "Offline Test Note"
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Offline Test Note');
		await page.getByTestId('close-editor-btn').click();

		// Then the note appears in the list
		await expect(page.getByText('Offline Test Note')).toBeVisible();
	});

	test('Scenario: Edited note persists in the UI when offline', async ({ authenticatedPage: page }) => {
		// Given a note titled "Offline Edit" exists
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Offline Edit');
		await page.getByTestId('close-editor-btn').click();
		await expect(page.getByText('Offline Edit')).toBeVisible();

		// When the network is unavailable
		await page.context().setOffline(true);

		// And the user edits the note title to "Offline Edited"
		await page.getByTestId('note-card').click();
		await page.getByTestId('note-title-input').clear();
		await page.getByTestId('note-title-input').fill('Offline Edited');
		await page.getByTestId('close-editor-btn').click();

		// Then the note "Offline Edited" appears in the list
		await expect(page.getByText('Offline Edited')).toBeVisible();

		// And a "Saved offline" toast is shown
		await expect(page.getByText('Saved offline')).toBeVisible();
	});

	test('Scenario: New note appears in the UI when created offline', async ({ authenticatedPage: page }) => {
		// When the network is unavailable
		await page.context().setOffline(true);

		// And the user creates a note titled "Offline New"
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Offline New');
		await page.getByTestId('close-editor-btn').click();

		// Then the note "Offline New" appears in the list
		await expect(page.getByText('Offline New')).toBeVisible();

		// And a "Saved offline" toast is shown
		await expect(page.getByText('Saved offline')).toBeVisible();
	});

	test('Scenario: Offline note survives a page reload after reconnecting', async ({ authenticatedPage: page }) => {
		// When the network is unavailable
		await page.context().setOffline(true);

		// And the user creates a note titled "Survive Reload"
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Survive Reload');
		await page.getByTestId('close-editor-btn').click();
		await expect(page.getByText('Survive Reload')).toBeVisible();

		// When the network is restored (triggers 'online' event + navigator.onLine = true)
		await page.context().setOffline(false);

		// And the sync completes
		await page.waitForResponse('**/api/sync');

		// And the user reloads the page
		await page.reload();

		// Then the note is still visible
		await expect(page.getByText('Survive Reload')).toBeVisible();
	});

	test('Scenario: Trashed note disappears from the list when offline', async ({ authenticatedPage: page }) => {
		// Given a note titled "Offline Trash" exists
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Offline Trash');
		await page.getByTestId('close-editor-btn').click();
		await expect(page.getByText('Offline Trash')).toBeVisible();

		// When the network is unavailable
		await page.context().setOffline(true);

		// And the user trashes the note
		await page.getByTestId('note-card').hover();
		await page.getByTestId('trash-btn').click();

		// Then the note is no longer visible
		await expect(page.getByText('Offline Trash')).not.toBeVisible();

		// And a "Saved offline" toast is shown
		await expect(page.getByText('Saved offline')).toBeVisible();
	});
});
