import { test, expect } from './helpers/fixtures.js';

test.describe('Search', () => {
	test('Scenario: Searching by title returns the matching note', async ({ authenticatedPage: page }) => {
		// Given a note titled "Shopping List" and a note titled "Work Meeting" exist
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Shopping List');
		await page.getByTestId('close-editor-btn').click();

		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Work Meeting');
		await page.getByTestId('close-editor-btn').click();

		// When the user searches for "Shopping"
		await page.getByTestId('search-input').fill('Shopping');
		await page.waitForTimeout(500);

		// Then "Shopping List" is visible in the results
		await expect(page.getByText('Shopping List')).toBeVisible();
	});

	test('Scenario: Searching by content returns the matching note', async ({ authenticatedPage: page }) => {
		// Given a note titled "Recipe" with content "Pasta with tomato sauce" exists
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Recipe');
		await page.getByTestId('note-content-input').fill('Pasta with tomato sauce');
		await page.getByTestId('close-editor-btn').click();

		// When the user searches for "tomato"
		await page.getByTestId('search-input').fill('tomato');
		await page.waitForTimeout(500);

		// Then "Recipe" is visible in the results
		await expect(page.getByText('Recipe')).toBeVisible();
	});

	test('Scenario: Searching for a nonexistent term yields no results', async ({ authenticatedPage: page }) => {
		// When the user searches for a term that matches nothing
		await page.getByTestId('search-input').fill('xyznonexistent');
		await page.waitForTimeout(500);

		// Then no notes are displayed
		await expect(page.getByTestId('note-card')).not.toBeVisible();
	});
});
