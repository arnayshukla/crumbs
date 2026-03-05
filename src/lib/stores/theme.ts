import { writable } from 'svelte/store';
import { browser } from '$app/environment';

type Theme = 'light' | 'dark' | 'system';

function getInitialTheme(): Theme {
	if (!browser) return 'system';
	return (localStorage.getItem('theme') as Theme) || 'system';
}

function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
	if (theme !== 'system') return theme;
	if (!browser) return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const themePreference = writable<Theme>(getInitialTheme());
export const effectiveTheme = writable<'light' | 'dark'>('light');

if (browser) {
	themePreference.subscribe((theme) => {
		localStorage.setItem('theme', theme);
		const effective = getEffectiveTheme(theme);
		effectiveTheme.set(effective);
		document.documentElement.classList.toggle('dark', effective === 'dark');
	});

	// Listen for system theme changes
	window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
		themePreference.update((current) => {
			if (current === 'system') {
				const effective = getEffectiveTheme('system');
				effectiveTheme.set(effective);
				document.documentElement.classList.toggle('dark', effective === 'dark');
			}
			return current;
		});
	});
}

export function toggleTheme() {
	themePreference.update((current) => {
		const effective = getEffectiveTheme(current);
		return effective === 'dark' ? 'light' : 'dark';
	});
}
