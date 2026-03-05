import type { NoteColor } from '$lib/types/index.js';

export const NOTE_COLORS: Record<NoteColor, { light: string; dark: string; label: string }> = {
	default: { light: '#ffffff', dark: '#202124', label: 'Default' },
	coral: { light: '#faafa8', dark: '#77172e', label: 'Coral' },
	peach: { light: '#f39f76', dark: '#692b17', label: 'Peach' },
	sand: { light: '#fff8b8', dark: '#7c4a03', label: 'Sand' },
	mint: { light: '#e2f6d3', dark: '#264d3b', label: 'Mint' },
	sage: { light: '#b4ddd3', dark: '#0c625d', label: 'Sage' },
	fog: { light: '#d4e4ed', dark: '#256377', label: 'Fog' },
	storm: { light: '#aeccdc', dark: '#284255', label: 'Storm' },
	dusk: { light: '#d3bfdb', dark: '#472e5b', label: 'Dusk' },
	blossom: { light: '#f6e2dd', dark: '#6c394f', label: 'Blossom' },
	clay: { light: '#e9e3d4', dark: '#4b443a', label: 'Clay' },
	chalk: { light: '#efeff1', dark: '#232427', label: 'Chalk' }
};

export const COLOR_OPTIONS = Object.entries(NOTE_COLORS).map(([value, { label }]) => ({
	value: value as NoteColor,
	label
}));
