<script lang="ts">
	import NoteCard from './NoteCard.svelte';
	import GripVertical from 'lucide-svelte/icons/grip-vertical';
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
						class="absolute top-2 left-2 z-10 cursor-grab rounded-sm p-1 text-[var(--text-muted)] opacity-60 hover:opacity-100 hover:bg-[var(--border-subtle)]/50 transition-opacity duration-150"
						data-testid="note-drag-handle"
					>
						<GripVertical class="h-4 w-4" />
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
