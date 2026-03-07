import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type SortMode = 'updated' | 'created' | 'custom';

const STORAGE_KEY = 'crumbs-sort-mode';

function getInitial(): SortMode {
	if (browser) {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === 'updated' || stored === 'created' || stored === 'custom') {
			return stored;
		}
	}
	return 'updated';
}

export const sortMode = writable<SortMode>(getInitial());

if (browser) {
	sortMode.subscribe((value) => {
		localStorage.setItem(STORAGE_KEY, value);
	});
}
