<script lang="ts">
	import NoteCard from './NoteCard.svelte';
	import type { Note } from '$lib/types/index.js';

	interface Props {
		notes: Note[];
		label?: string;
		onEdit: (note: Note) => void;
	}

	let { notes, label = '', onEdit }: Props = $props();
</script>

{#if notes.length > 0}
	{#if label}
		<p class="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
	{/if}
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" data-testid="note-grid">
		{#each notes as note (note.id)}
			<NoteCard {note} {onEdit} />
		{/each}
	</div>
{/if}
