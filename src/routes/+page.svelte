<script lang="ts">
	import NoteGrid from '$lib/components/NoteGrid.svelte';
	import NoteEditor from '$lib/components/NoteEditor.svelte';
	import TagFilter from '$lib/components/TagFilter.svelte';
	import { pinnedNotes, unpinnedNotes, selectedTag, currentFilter } from '$lib/stores/notes.js';
	import type { Note } from '$lib/types/index.js';

	let editingNote: Note | null = $state(null);
	let showNewNote = $state(false);

	function openEditor(note: Note) {
		editingNote = note;
	}

	function closeEditor() {
		editingNote = null;
		showNewNote = false;
	}
</script>

<svelte:head>
	<title>Crumbs</title>
</svelte:head>

{#if $currentFilter === 'all'}
	<div class="mx-auto mb-6 max-w-xl">
		<button
			onclick={() => (showNewNote = true)}
			class="w-full rounded-lg border border-gray-300 px-4 py-3 text-left text-sm text-gray-500 shadow-sm transition-shadow hover:shadow-md"
			data-testid="new-note-btn"
		>
			Add a crumb...
		</button>
	</div>
{/if}

<div class="mb-4">
	<TagFilter />
</div>

{#if $currentFilter === 'archived'}
	<h2 class="mb-4 text-lg font-medium text-gray-600">Archive</h2>
{:else if $currentFilter === 'trashed'}
	<h2 class="mb-4 text-lg font-medium text-gray-600">Trash</h2>
{/if}

{#if $pinnedNotes.length > 0}
	<div class="mb-6">
		<NoteGrid notes={$pinnedNotes} label="Pinned" onEdit={openEditor} />
	</div>
{/if}

<NoteGrid
	notes={$unpinnedNotes}
	label={$pinnedNotes.length > 0 ? 'Others' : ''}
	onEdit={openEditor}
/>

{#if $pinnedNotes.length === 0 && $unpinnedNotes.length === 0}
	<div class="flex flex-col items-center justify-center py-20 text-gray-400">
		<svg class="mb-4 h-24 w-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
		</svg>
		<p class="text-lg">
			{#if $currentFilter === 'trashed'}
				No crumbs in trash
			{:else if $currentFilter === 'archived'}
				No archived crumbs
			{:else if $selectedTag}
				No crumbs with tag #{$selectedTag}
			{:else}
				Your crumbs will appear here
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
