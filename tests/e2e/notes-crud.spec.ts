import { test, expect } from './helpers/fixtures.js';

test.describe('Notes CRUD', () => {
	test('Scenario: Fresh account shows an empty notes list', async ({ authenticatedPage: page }) => {
		// Given the user has no notes
		// Then the empty state message is displayed
		await expect(page.getByText('Notes you add appear here')).toBeVisible();
	});

	test('Scenario: New note appears in the notes list after creation', async ({ authenticatedPage: page }) => {
		// When the user creates a note titled "My First Note" with content "Hello world!"
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('My First Note');
		await page.getByTestId('note-content-input').fill('Hello world!');
		await page.getByTestId('close-editor-btn').click();

		// Then the note is visible in the notes list
		await expect(page.getByTestId('note-card')).toBeVisible();
		await expect(page.getByText('My First Note')).toBeVisible();
	});

	test('Scenario: Edited note title is reflected in the notes list', async ({ authenticatedPage: page }) => {
		// Given a note titled "Original Title" exists
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Original Title');
		await page.getByTestId('note-content-input').fill('Original content');
		await page.getByTestId('close-editor-btn').click();

		// When the user changes the title to "Updated Title"
		await page.getByTestId('note-card').click();
		await page.getByTestId('note-title-input').clear();
		await page.getByTestId('note-title-input').fill('Updated Title');
		await page.getByTestId('close-editor-btn').click();

		// Then the updated title is displayed
		await expect(page.getByText('Updated Title')).toBeVisible();
	});

	test('Scenario: Trashed note disappears from the main view', async ({ authenticatedPage: page }) => {
		// Given a note titled "Delete Me" exists
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Delete Me');
		await page.getByTestId('close-editor-btn').click();

		// When the user trashes the note
		await page.getByTestId('note-card').hover();
		await page.getByTestId('trash-btn').click();

		// Then the note is no longer visible
		await expect(page.getByText('Delete Me')).not.toBeVisible();
	});

	test('Scenario: Markdown content is rendered in the note preview', async ({ authenticatedPage: page }) => {
		// Given a note with markdown content "**bold text**"
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-content-input').fill('**bold text**');

		// When the user switches to preview mode
		await page.getByTestId('preview-toggle').click();

		// Then the rendered preview contains the formatted text
		await expect(page.getByTestId('note-preview')).toContainText('bold text');
	});
});
