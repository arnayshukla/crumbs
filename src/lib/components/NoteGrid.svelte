<script lang="ts">
	import NoteCard from './NoteCard.svelte';
	import GripHorizontal from 'lucide-svelte/icons/grip-horizontal';
	import { dragHandleZone, dragHandle, type DndEvent } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import type { Note } from '$lib/types/index.js';

	interface Props {
		notes: Note[];
		label?: string;
		onEdit: (note: Note) => void;
		draggable?: boolean;
		dndType?: string;
		onReorder?: (noteIds: string[]) => void;
	}

	let { notes, label = '', onEdit, draggable = false, dndType = 'notes', onReorder }: Props = $props();

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
			use:dragHandleZone={{ items: localItems, flipDurationMs, type: dndType, dropTargetStyle: {} }}
			onconsider={handleConsider}
			onfinalize={handleFinalize}
		>
			{#each localItems as note (note.id)}
				<div class="relative h-full" animate:flip={{ duration: flipDurationMs }}>
					<div
						use:dragHandle
						aria-label="drag handle for {note.title || 'note'}"
						class="absolute top-0 left-1/2 z-10 flex -translate-x-1/2 cursor-grab items-center justify-center px-6 py-0.5 text-[var(--text-muted)] opacity-40 transition-opacity duration-150 hover:opacity-70 active:cursor-grabbing outline-none"
						data-testid="note-drag-handle"
					>
						<GripHorizontal class="h-3.5 w-3.5" />
					</div>
					<NoteCard {note} {onEdit} fullHeight />
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
