import { test, expect, createNote } from './helpers/fixtures.js';

test.describe('Search', () => {
	test('Scenario: Searching by title returns the matching note', async ({ authenticatedPage: page }) => {
		// Given a note titled "Grocery Errands" and a note titled "Work Meeting" exist
		await createNote(page, 'Grocery Errands');
		await createNote(page, 'Work Meeting');

		// When the user searches for "Grocery"
		await page.getByTestId('search-input').fill('Grocery');

		// Then "Grocery Errands" is visible in the results
		await expect(page.getByText('Grocery Errands')).toBeVisible();
	});

	test('Scenario: Searching by content returns the matching note', async ({ authenticatedPage: page }) => {
		// Given a note titled "Recipe" with content "Pasta with tomato sauce" exists
		await createNote(page, 'Recipe', 'Pasta with tomato sauce');

		// When the user searches for "tomato"
		await page.getByTestId('search-input').fill('tomato');

		// Then "Recipe" is visible in the results
		await expect(page.getByText('Recipe')).toBeVisible();
	});

	test('Scenario: Searching for a nonexistent term yields no results', async ({ authenticatedPage: page }) => {
		// When the user searches for a term that matches nothing
		await page.getByTestId('search-input').fill('xyznonexistent');

		// Then no notes are displayed
		await expect(page.getByTestId('note-card')).toHaveCount(0);
	});
});
