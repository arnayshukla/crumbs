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

	test('Scenario: Browser back closes the open editor instead of leaving the page', async ({ authenticatedPage: page }) => {
		// Given a note titled "Back Closes Me" exists
		await createNote(page, 'Back Closes Me', 'Some content');

		// Given the note is open in the editor
		await noteCard(page, 'Back Closes Me').click();
		await expect(page.getByTestId('note-editor')).toBeVisible();

		// When the user navigates back
		await page.goBack();

		// Then the editor is closed and the notes list is still shown
		await expect(page.getByTestId('note-editor')).not.toBeVisible();
		await expect(noteCard(page, 'Back Closes Me')).toBeVisible();
	});

	test('Scenario: Closing the editor leaves browser history clean', async ({ authenticatedPage: page }) => {
		// Given a note titled "Clean History" exists
		await createNote(page, 'Clean History');

		// Given the user opened and closed the note
		await noteCard(page, 'Clean History').click();
		await expect(page.getByTestId('note-editor')).toBeVisible();
		await page.getByTestId('close-editor-btn').click();
		await expect(page.getByTestId('note-editor')).not.toBeVisible();

		// When the user navigates back
		await page.goBack();

		// Then the editor does not reopen and the note's URL is gone from history
		await expect(page.getByTestId('note-editor')).not.toBeVisible();
		expect(page.url()).not.toContain('#');
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

	test('Scenario: A server-absent captured crumb is removed after a 404 action', async ({ authenticatedPage: page }, testInfo) => {
		const title = `Captured ghost ${testInfo.workerIndex}-${Date.now()}`;
		const created = await page.request.post('/api/notes', { data: { title } });
		const crumb = await created.json() as { id: string };
		await page.goto('/');
		const card = noteCard(page, title);
		await expect(card).toBeVisible();

		// Simulate a stale cached card whose server-side record has already gone.
		// Intercept the UI request so the background refresh cannot remove it first.
		await page.route(`**/api/notes/${crumb.id}`, async (route) => {
			if (route.request().method() === 'PATCH') {
				await route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"Not found"}' });
				return;
			}
			await route.continue();
		});
		await card.hover();
		await card.getByTestId('trash-btn').click({ force: true });

		await expect(card).toHaveCount(0);
		await expect(page.getByTestId('toast')).toContainText('no longer exists or belongs to another account');
		expect((await page.request.delete(`/api/notes/${crumb.id}`)).ok()).toBeTruthy();
	});

	test('Scenario: Authoritative refresh does not resurrect a deleted cached crumb', async ({ authenticatedPage: page }, testInfo) => {
		const title = `Cached ghost ${testInfo.workerIndex}-${Date.now()}`;
		const created = await page.request.post('/api/notes', { data: { title } });
		const crumb = await created.json() as { id: string };
		await page.goto('/');
		await expect(noteCard(page, title)).toBeVisible();
		expect((await page.request.delete(`/api/notes/${crumb.id}`)).ok()).toBeTruthy();

		await page.reload();
		await expect(noteCard(page, title)).toHaveCount(0);
	});
});
