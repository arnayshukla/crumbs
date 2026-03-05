import { test, expect } from './helpers/fixtures.js';

test.describe('Checklist', () => {
	test('Scenario: Checklist UI replaces editor when checklist mode is enabled', async ({ authenticatedPage: page }) => {
		// Given the user is creating a new note
		await page.getByTestId('new-note-btn').click();

		// When the user enables checklist mode
		await page.getByTestId('checklist-toggle').click();

		// Then the checklist component is displayed
		await expect(page.getByTestId('checklist')).toBeVisible();

		// And the rich text editor is hidden
		await expect(page.getByTestId('tiptap-editor')).not.toBeVisible();
	});

	test('Scenario: Checklist item can be added and persisted', async ({ authenticatedPage: page }) => {
		// When the user creates a checklist note with an item "Buy milk"
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Shopping List');
		await page.getByTestId('checklist-toggle').click();
		await page.getByTestId('checklist-input').first().fill('Buy milk');
		await page.getByTestId('close-editor-btn').click();

		// Then the note appears in the list
		await expect(page.getByText('Shopping List')).toBeVisible();

		// When the user reopens the note
		await page.getByTestId('note-card').click();

		// Then the checklist is displayed with the saved item
		await expect(page.getByTestId('checklist')).toBeVisible();
		await expect(page.getByTestId('checklist-input').first()).toHaveValue('Buy milk');
	});

	test('Scenario: Checking an item marks it as completed', async ({ authenticatedPage: page }) => {
		// Given a checklist note with an item "Buy milk"
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Tasks');
		await page.getByTestId('checklist-toggle').click();
		await page.getByTestId('checklist-input').first().fill('Buy milk');
		await page.getByTestId('close-editor-btn').click();

		// When the user reopens the note and checks the item
		await page.getByTestId('note-card').click();
		await page.getByTestId('checklist-checkbox').first().check();
		await page.getByTestId('close-editor-btn').click();

		// Then reopening the note shows the item is still checked
		await page.getByTestId('note-card').click();
		await expect(page.getByTestId('checklist-checkbox').first()).toBeChecked();
	});

	test('Scenario: New checklist item is added by pressing Enter', async ({ authenticatedPage: page }) => {
		// Given the user is editing a checklist note
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('checklist-toggle').click();
		await page.getByTestId('checklist-input').first().fill('First item');

		// When the user presses Enter
		await page.getByTestId('checklist-input').first().press('Enter');

		// Then a second checklist item appears
		await expect(page.getByTestId('checklist-input')).toHaveCount(2);
	});

	test('Scenario: Empty checklist item is removed by pressing Backspace', async ({ authenticatedPage: page }) => {
		// Given a checklist note with two items
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('checklist-toggle').click();
		await page.getByTestId('checklist-input').first().fill('First item');
		await page.getByTestId('checklist-input').first().press('Enter');
		await expect(page.getByTestId('checklist-input')).toHaveCount(2);

		// When the user presses Backspace on the empty second item
		await page.getByTestId('checklist-input').nth(1).press('Backspace');

		// Then only the first item remains
		await expect(page.getByTestId('checklist-input')).toHaveCount(1);
	});

	test('Scenario: Switching back from checklist mode restores the text area', async ({ authenticatedPage: page }) => {
		// Given the user has checklist mode enabled
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('checklist-toggle').click();
		await expect(page.getByTestId('checklist')).toBeVisible();

		// When the user disables checklist mode
		await page.getByTestId('checklist-toggle').click();

		// Then the rich text editor is displayed again
		await expect(page.getByTestId('tiptap-editor')).toBeVisible();
		await expect(page.getByTestId('checklist')).not.toBeVisible();
	});
});
