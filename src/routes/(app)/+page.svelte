<script lang="ts">
	import NoteGrid from '$lib/components/NoteGrid.svelte';
	import NoteEditor from '$lib/components/NoteEditor.svelte';
	import TagFilter from '$lib/components/TagFilter.svelte';
	import SortSelector from '$lib/components/SortSelector.svelte';
	import { pinnedNotes, unpinnedNotes, selectedTag, currentFilter, notes, notesLoaded, updateSortOrders } from '$lib/stores/notes.js';
	import { sortMode } from '$lib/stores/sort.js';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import type { Note } from '$lib/types/index.js';
	import Plus from 'lucide-svelte/icons/plus';

	let editingNote: Note | null = $state(null);
	let showNewNote = $state(false);

	function openEditor(note: Note) {
		editingNote = note;
		history.replaceState(null, '', `#${note.id}`);
	}

	function closeEditor() {
		editingNote = null;
		showNewNote = false;
		history.replaceState(null, '', location.pathname);
	}

	function handleReorder(noteIds: string[]) {
		const orders = noteIds.map((id, index) => ({ id, sortOrder: index }));
		updateSortOrders(orders);
	}

	onMount(() => {
		const hash = location.hash.slice(1);
		if (!hash) return;

		// Notes may not be loaded yet — wait for them
		const unsubscribe = notes.subscribe(($notes) => {
			if ($notes.length === 0) return;
			const note = $notes.find((n) => n.id === hash);
			if (note) editingNote = note;
			unsubscribe();
		});
	});
</script>

<svelte:head>
	<title>Crumbs</title>
</svelte:head>

{#if $currentFilter === 'all'}
	<div class="mx-auto mb-6 max-w-xl">
		<button
			onclick={() => (showNewNote = true)}
			class="flex w-full items-center gap-3 rounded-sm border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-left text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
			data-testid="new-note-btn"
		>
			<Plus class="h-4 w-4" />
			Add a crumb...
		</button>
	</div>
{/if}

{#if $currentFilter === 'all'}
	<div class="mb-4 flex flex-wrap items-start justify-between gap-3">
		<TagFilter />
		<SortSelector />
	</div>
{:else}
	<div class="mb-4">
		<TagFilter />
	</div>
{/if}

{#if $currentFilter === 'archived'}
	<h2 class="mb-4 text-lg font-medium text-[var(--text-muted)]">Archive</h2>
{:else if $currentFilter === 'trashed'}
	<h2 class="mb-4 text-lg font-medium text-[var(--text-muted)]">Trash</h2>
{/if}

{#if $pinnedNotes.length > 0}
	<div class="mb-6">
		<NoteGrid notes={$pinnedNotes} label="Pinned" onEdit={openEditor} draggable={$sortMode === 'custom'} dndType="pinned-notes" onReorder={handleReorder} />
	</div>
{/if}

<NoteGrid
	notes={$unpinnedNotes}
	label={$pinnedNotes.length > 0 ? 'Others' : ''}
	onEdit={openEditor}
	draggable={$sortMode === 'custom'}
	dndType="unpinned-notes"
	onReorder={handleReorder}
/>

{#if $notesLoaded && $pinnedNotes.length === 0 && $unpinnedNotes.length === 0}
	<div class="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
		<img src="/favicon.svg" alt="" class="mb-4 h-18 w-18" />
		<p class="font-['Press_Start_2P'] text-xs">
			{#if $currentFilter === 'trashed'}
				No crumbs in trash
			{:else if $currentFilter === 'archived'}
				No archived crumbs
			{:else if $selectedTag}
				No crumbs with tag #{$selectedTag}
			{:else}
				No crumbs yet
			{/if}
		</p>
	</div>
{/if}

{#if showNewNote}
	<NoteEditor note={null} isNew={true} onClose={closeEditor} />
{/if}

{#if editingNote}
	<NoteEditor note={editingNote} onClose={closeEditor} />
{/if}
