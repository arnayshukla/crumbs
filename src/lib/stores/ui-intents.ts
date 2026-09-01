import { writable } from 'svelte/store';

export type UiIntent =
	| { type: 'new-note'; checklist: boolean }
	| { type: 'open-note'; noteId: string };

export const uiIntent = writable<UiIntent | null>(null);
