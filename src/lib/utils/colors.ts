import type { NoteColor } from '$lib/types/index.js';

export const NOTE_COLORS: Record<NoteColor, { bg: string; label: string }> = {
	default: { bg: '#ffffff', label: 'Default' },
	coral: { bg: '#faafa8', label: 'Coral' },
	peach: { bg: '#f39f76', label: 'Peach' },
	sand: { bg: '#fff8b8', label: 'Sand' },
	mint: { bg: '#e2f6d3', label: 'Mint' },
	sage: { bg: '#b4ddd3', label: 'Sage' },
	fog: { bg: '#d4e4ed', label: 'Fog' },
	storm: { bg: '#aeccdc', label: 'Storm' },
	dusk: { bg: '#d3bfdb', label: 'Dusk' },
	blossom: { bg: '#f6e2dd', label: 'Blossom' },
	clay: { bg: '#e9e3d4', label: 'Clay' },
	chalk: { bg: '#efeff1', label: 'Chalk' }
};

export const COLOR_OPTIONS = Object.entries(NOTE_COLORS).map(([value, { label }]) => ({
	value: value as NoteColor,
	label
}));
