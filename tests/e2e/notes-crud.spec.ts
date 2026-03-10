import { test, expect, noteCard, createNote } from './helpers/fixtures.js';

test.describe('Notes CRUD', () => {
	test('Scenario: New note appears in the notes list after creation', async ({ authenticatedPage: page }) => {
		// When the user creates a note titled "My First Note" with content "Hello world!"
		await createNote(page, 'My First Note', 'Hello world!');

		// Then the note is visible in the notes list
		await expect(noteCard(page, 'My First Note')).toBeVisible();
	});

	test('Scenario: Edited note title is reflected in the notes list', async ({ authenticatedPage: page }) => {
		// Given a note titled "Original Title" exists
		await createNote(page, 'Original Title', 'Original content');

		// When the user changes the title to "Updated Title"
		await noteCard(page, 'Original Title').click();
		await page.getByTestId('note-title-input').clear();
		await page.getByTestId('note-title-input').fill('Updated Title');
		await page.getByTestId('close-editor-btn').click();

		// Then the updated title is displayed
		await expect(page.getByText('Updated Title')).toBeVisible();
	});

	test('Scenario: Trashed note disappears from the main view', async ({ authenticatedPage: page }) => {
		// Given a note titled "Delete Me" exists
		await createNote(page, 'Delete Me');

		// When the user trashes the note
		const card = noteCard(page, 'Delete Me');
		await card.hover();
		await card.getByTestId('trash-btn').click({ force: true });

		// Then the note is no longer visible
		await expect(page.getByText('Delete Me')).not.toBeVisible();
	});
});
