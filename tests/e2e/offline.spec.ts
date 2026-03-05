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
});
