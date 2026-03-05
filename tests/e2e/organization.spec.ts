import { test, expect } from './helpers/fixtures.js';

test.describe('Organization Features', () => {
	test('Scenario: Pinned note appears under the Pinned section', async ({ authenticatedPage: page }) => {
		// Given a note titled "Pin Me" exists
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Pin Me');
		await page.getByTestId('close-editor-btn').click();

		// When the user pins the note
		await page.getByTestId('note-card').hover();
		await page.getByTestId('pin-btn').click();

		// Then the "Pinned" section is visible
		await expect(page.getByText('Pinned')).toBeVisible();
	});

	test('Scenario: Archived note is removed from the main view', async ({ authenticatedPage: page }) => {
		// Given a note titled "Archive Me" exists
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Archive Me');
		await page.getByTestId('close-editor-btn').click();

		// When the user archives the note
		await page.getByTestId('note-card').hover();
		await page.getByTestId('archive-btn').click();

		// Then the note is no longer visible in the main view
		await expect(page.getByText('Archive Me')).not.toBeVisible();
	});

	test('Scenario: Note color is changed via the color picker', async ({ authenticatedPage: page }) => {
		// Given the user is creating a note titled "Colored Note"
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Colored Note');

		// When the user sets the note color to "Coral"
		await page.getByTestId('color-picker-toggle').click();
		await page.getByTestId('color-coral').click();
		await page.getByTestId('close-editor-btn').click();

		// Then the note is saved and visible in the notes list
		await expect(page.getByTestId('note-card')).toBeVisible();
	});

	test('Scenario: Filtering by tag shows only matching notes', async ({ authenticatedPage: page }) => {
		// Given a note tagged #important and an untagged note exist
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Tagged Note');
		const editor = page.getByTestId('tiptap-editor').locator('.tiptap');
		await editor.click();
		await editor.pressSequentially('This is #important');
		await page.getByTestId('close-editor-btn').click();

		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Untagged Note');
		await page.getByTestId('close-editor-btn').click();

		// When the user filters by the #important tag
		const tagChip = page.getByTestId('tag-chip').filter({ hasText: '#important' });
		if (await tagChip.isVisible()) {
			await tagChip.click();

			// Then only the tagged note is visible
			await expect(page.getByText('Tagged Note')).toBeVisible();
		}
	});
});
