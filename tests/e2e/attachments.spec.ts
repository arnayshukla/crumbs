import { test, expect } from './helpers/fixtures.js';

test.describe('Image Attachments', () => {
	test('Scenario: Note editor is available for creating a new note', async ({ authenticatedPage: page }) => {
		// When the user starts creating a new note
		await page.getByTestId('new-note-btn').click();

		// Then the note editor is displayed
		await expect(page.getByTestId('note-editor')).toBeVisible();
	});
});
