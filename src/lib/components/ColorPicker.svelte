<script lang="ts">
	import { NOTE_COLORS, COLOR_OPTIONS } from '$lib/utils/colors.js';
	import { effectiveTheme } from '$lib/stores/theme.js';
	import type { NoteColor } from '$lib/types/index.js';

	interface Props {
		selected: NoteColor;
		onSelect: (color: NoteColor) => void;
	}

	let { selected, onSelect }: Props = $props();
</script>

<div class="flex flex-wrap gap-1" data-testid="color-picker">
	{#each COLOR_OPTIONS as option}
		{@const colors = NOTE_COLORS[option.value]}
		<button
			onclick={() => onSelect(option.value)}
			class="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 {selected === option.value ? 'border-gray-800 dark:border-white' : 'border-transparent'}"
			style="background-color: {$effectiveTheme === 'dark' ? colors.dark : colors.light}"
			title={option.label}
			data-testid="color-{option.value}"
		></button>
	{/each}
</div>
