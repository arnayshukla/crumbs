import type { NoteColor } from './index.js';

export interface UserPreferences {
	defaultNoteMode: 'richtext' | 'markdown';
	defaultNoteColor: NoteColor;
	hideFooter: boolean;
	sidebarDefaultState: 'open' | 'collapsed';
}

export const DEFAULT_PREFERENCES: UserPreferences = {
	defaultNoteMode: 'richtext',
	defaultNoteColor: 'default',
	hideFooter: false,
	sidebarDefaultState: 'open'
};

export const BOOLEAN_PREF_KEYS: ReadonlySet<keyof UserPreferences> = new Set([
	'hideFooter'
]);
