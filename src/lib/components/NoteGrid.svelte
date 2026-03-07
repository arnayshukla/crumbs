<script lang="ts">
	import NoteCard from './NoteCard.svelte';
	import { dndzone, type DndEvent } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import type { Note } from '$lib/types/index.js';

	interface Props {
		notes: Note[];
		label?: string;
		onEdit: (note: Note) => void;
		draggable?: boolean;
		onReorder?: (noteIds: string[]) => void;
	}

	let { notes, label = '', onEdit, draggable = false, onReorder }: Props = $props();

	let localItems = $state<Note[]>([]);

	$effect(() => {
		localItems = [...notes];
	});

	const flipDurationMs = 150;

	function handleConsider(e: CustomEvent<DndEvent<Note>>) {
		localItems = e.detail.items;
	}

	function handleFinalize(e: CustomEvent<DndEvent<Note>>) {
		localItems = e.detail.items;
		onReorder?.(localItems.map((n) => n.id));
	}

	let displayItems = $derived(draggable ? localItems : notes);
</script>

{#if displayItems.length > 0}
	{#if label}
		<p class="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
	{/if}
	{#if draggable}
		<div
			class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
			data-testid="note-grid"
			use:dndzone={{ items: localItems, flipDurationMs, type: 'notes', dropTargetStyle: {} }}
			onconsider={handleConsider}
			onfinalize={handleFinalize}
		>
			{#each localItems as note (note.id)}
				<div animate:flip={{ duration: flipDurationMs }}>
					<NoteCard {note} {onEdit} />
				</div>
			{/each}
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" data-testid="note-grid">
			{#each displayItems as note (note.id)}
				<NoteCard {note} {onEdit} />
			{/each}
		</div>
	{/if}
{/if}
