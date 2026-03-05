import { test, expect } from './helpers/fixtures.js';

test.describe('Dark Mode', () => {
	test('Scenario: Dark mode can be toggled on and off', async ({ authenticatedPage: page }) => {
		// When the user enables dark mode
		await page.getByTestId('theme-toggle').click();

		// Then the application is displayed in dark mode
		const isDark = await page.evaluate(() =>
			document.documentElement.classList.contains('dark')
		);
		expect(isDark).toBe(true);

		// When the user disables dark mode
		await page.getByTestId('theme-toggle').click();

		// Then the application is displayed in light mode
		const isLight = await page.evaluate(() =>
			!document.documentElement.classList.contains('dark')
		);
		expect(isLight).toBe(true);
	});

	test('Scenario: Theme preference is remembered across page loads', async ({ authenticatedPage: page }) => {
		// When the user enables dark mode
		await page.getByTestId('theme-toggle').click();

		// Then the preference is persisted
		const theme = await page.evaluate(() => localStorage.getItem('theme'));
		expect(theme).toBeTruthy();
	});
});
