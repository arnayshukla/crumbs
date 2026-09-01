<script lang="ts">
	import NoteGrid from '$lib/components/NoteGrid.svelte';
	import NoteEditor from '$lib/components/NoteEditor.svelte';
	import TagFilter from '$lib/components/TagFilter.svelte';
	import { pinnedNotes, unpinnedNotes, selectedTag, currentFilter, notes, notesLoaded, loadNotes, updateSortOrders, bulkNoteAction } from '$lib/stores/notes.js';
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import type { Note, NoteFilter, NoteColor, BulkNoteAction } from '$lib/types/index.js';
	import Plus from 'lucide-svelte/icons/plus';
	import SquareCheck from 'lucide-svelte/icons/square-check';
	import { tooltip } from '$lib/utils/tooltip.js';
	import { getNote as getIdbNote } from '$lib/sync/idb.js';
	import { uiIntent } from '$lib/stores/ui-intents.js';

	interface Props {
		filter: NoteFilter;
		tag?: string | null;
	}

	let { filter, tag = null }: Props = $props();

	let editingNote: Note | null = $state(null);
	let showNewNote = $state(false);
	let newNoteChecklist = $state(false);
	let selectionMode = $state(false);
	let selectedIds = $state<Set<string>>(new Set());
	let bulkColor = $state<NoteColor>('default');
	let selectedNotes = $derived($notes.filter((note) => selectedIds.has(note.id)));
	let selectionOwned = $derived(selectedNotes.every((note) => note.isOwner !== false));

	// Sync store with route props and reload notes when filter changes
	$effect(() => {
		currentFilter.set(filter);
		selectedTag.set(tag);
		loadNotes(filter);
	});

	// Use SvelteKit's replaceState (not the raw history API) so the router keeps
	// ownership of the entry — NoteEditor's close-on-back relies on popstate being
	// handled by SvelteKit.
	function openEditor(note: Note) {
		editingNote = note;
		replaceState(`#${note.id}`, {});
	}

	function closeEditor() {
		editingNote = null;
		showNewNote = false;
		newNoteChecklist = false;
		replaceState(location.pathname, {});
	}

	// Reads from the local IndexedDB cache rather than fetching over the network —
	// this keeps note-link navigation instant and offline-safe (matching how the
	// rest of the app opens notes), and backlinks are filled in progressively by
	// NoteEditor's own fetch-if-not-pre-populated effect once the editor is open,
	// the same pattern already used there for attachments.
	let openNoteRequestId = 0;

	async function openNoteById(noteId: string) {
		const requestId = ++openNoteRequestId;
		const note = await getIdbNote(noteId);
		if (requestId !== openNoteRequestId) return; // a newer navigation superseded this one
		if (note) openEditor(note);
	}

	function handleReorder(noteIds: string[]) {
		const orders = noteIds.map((id, index) => ({ id, sortOrder: index }));
		updateSortOrders(orders);
	}

	function toggleSelection(note: Note) {
		const next = new Set(selectedIds);
		if (next.has(note.id)) next.delete(note.id);
		else next.add(note.id);
		selectedIds = next;
	}

	function cancelSelection() {
		selectionMode = false;
		selectedIds = new Set();
	}

	async function runBulk(action: BulkNoteAction['action']) {
		if (selectedIds.size === 0) return;
		if (['trash', 'delete'].includes(action) && !confirm(`${action === 'delete' ? 'Delete forever' : 'Trash'} ${selectedIds.size} crumbs?`)) return;
		const payload: BulkNoteAction = action === 'color'
			? { action, noteIds: [...selectedIds], color: bulkColor }
			: { action, noteIds: [...selectedIds] };
		if (await bulkNoteAction(payload)) cancelSelection();
	}

	onMount(() => {
		const unsubscribeIntent = uiIntent.subscribe((intent) => {
			if (!intent) return;
			uiIntent.set(null);
			if (intent.type === 'new-note') {
				newNoteChecklist = intent.checklist;
				showNewNote = true;
			} else {
				openNoteById(intent.noteId);
			}
		});
		const hash = location.hash.slice(1);
		if (!hash) return unsubscribeIntent;

		const unsubscribe = notes.subscribe(($notes) => {
			if ($notes.length === 0) return;
			const note = $notes.find((n) => n.id === hash);
			if (note) editingNote = note;
			unsubscribe();
		});
		return () => {
			unsubscribe();
			unsubscribeIntent();
		};
	});
</script>

{#if filter === 'all' && !tag}
	<div class="mx-auto mb-6 hidden max-w-xl md:block">
		<div class="flex cursor-pointer items-center gap-0 rounded-sm border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-colors hover:border-[var(--primary)]">
			<button
				onclick={() => (showNewNote = true)}
				class="flex flex-1 cursor-pointer items-center gap-3 px-4 py-3 text-left text-sm text-[var(--text-muted)] hover:text-[var(--primary)]"
				data-testid="new-note-btn"
			>
				<Plus class="h-4 w-4" />
				Add a crumb...
			</button>
			<button
				onclick={() => { newNoteChecklist = true; showNewNote = true; }}
				class="cursor-pointer rounded-sm p-3 text-[var(--text-muted)] hover:text-[var(--primary)]"
				use:tooltip={"New checklist"}
				data-testid="new-checklist-btn"
			>
				<SquareCheck class="h-4 w-4" />
			</button>
		</div>
	</div>
	<button
		onclick={() => (showNewNote = true)}
		class="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-sm border border-[var(--border)] bg-[var(--primary)] text-white shadow-[var(--card-shadow)] transition-colors hover:bg-[var(--primary-hover)] md:hidden"
		aria-label="Add a crumb"
		data-testid="new-note-fab"
	>
		<Plus class="h-5 w-5" />
	</button>
{/if}

<div class="mb-4">
	<div class="mb-3 flex flex-wrap items-center justify-end gap-2">
		{#if selectionMode}
			<span class="mr-auto text-sm text-[var(--text-muted)]">{selectedIds.size} selected</span>
			{#if filter === 'trashed'}
				<button class="rounded-sm px-3 py-2 text-sm hover:bg-[var(--bg-surface)]" onclick={() => runBulk('restore')}>Restore</button>
				<button disabled={!selectionOwned} class="rounded-sm px-3 py-2 text-sm text-[var(--destructive)] disabled:opacity-40" onclick={() => runBulk('delete')}>Delete forever</button>
			{:else}
				<button class="rounded-sm px-3 py-2 text-sm hover:bg-[var(--bg-surface)]" onclick={() => runBulk('pin')}>Pin</button>
				<button class="rounded-sm px-3 py-2 text-sm hover:bg-[var(--bg-surface)]" onclick={() => runBulk('unpin')}>Unpin</button>
				<button class="rounded-sm px-3 py-2 text-sm hover:bg-[var(--bg-surface)]" onclick={() => runBulk(filter === 'archived' ? 'unarchive' : 'archive')}>{filter === 'archived' ? 'Unarchive' : 'Archive'}</button>
				<select bind:value={bulkColor} onchange={() => runBulk('color')} class="rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-2 text-sm" aria-label="Set color">
					{#each ['default','coral','peach','sand','mint','sage','fog','storm','dusk','blossom','clay','chalk'] as option}<option value={option}>{option}</option>{/each}
				</select>
				<button disabled={!selectionOwned} class="rounded-sm px-3 py-2 text-sm text-[var(--destructive)] disabled:opacity-40" onclick={() => runBulk('trash')}>Trash</button>
			{/if}
			<button class="rounded-sm px-3 py-2 text-sm hover:bg-[var(--bg-surface)]" onclick={cancelSelection}>Cancel</button>
		{:else}
			<button class="rounded-sm border border-[var(--border)] px-3 py-2 text-sm hover:border-[var(--primary)]" onclick={() => (selectionMode = true)} data-testid="select-notes">Select</button>
		{/if}
	</div>
	<TagFilter />
</div>

{#if filter === 'archived'}
	<h2 class="mb-4 text-lg font-medium text-[var(--text-muted)]">Archive</h2>
{:else if filter === 'trashed'}
	<h2 class="mb-4 text-lg font-medium text-[var(--text-muted)]">Trash</h2>
{:else if tag}
	<h2 class="mb-4 text-lg font-medium text-[var(--text-muted)]">#{tag}</h2>
{/if}

{#if $pinnedNotes.length > 0}
	<div class="mb-6">
		<NoteGrid notes={$pinnedNotes} label="Pinned" onEdit={openEditor} draggable dndType="pinned-notes" onReorder={handleReorder} {selectionMode} {selectedIds} onToggleSelection={toggleSelection} />
	</div>
{/if}

<NoteGrid
	notes={$unpinnedNotes}
	label={$pinnedNotes.length > 0 ? 'Others' : ''}
	onEdit={openEditor}
	draggable
	dndType="unpinned-notes"
	onReorder={handleReorder}
	{selectionMode}
	{selectedIds}
	onToggleSelection={toggleSelection}
/>

{#if $notesLoaded && $pinnedNotes.length === 0 && $unpinnedNotes.length === 0}
	<div class="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
		<img src="/favicon.svg" alt="" class="mb-4 h-18 w-18" />
		<p class="font-['Press_Start_2P'] text-xs">
			{#if filter === 'trashed'}
				No crumbs in trash
			{:else if filter === 'archived'}
				No archived crumbs
			{:else if tag}
				No crumbs with tag #{tag}
			{:else}
				No crumbs yet
			{/if}
		</p>
	</div>
{/if}

{#if showNewNote}
	<NoteEditor note={null} isNew={true} initialChecklistMode={newNoteChecklist} onClose={closeEditor} onOpenNote={openNoteById} />
{/if}

{#if editingNote}
	<!-- Forces a full destroy+remount on note-switch (e.g. clicking a note-link
	     while the editor is already open) instead of reusing the same instance
	     with a new `note` prop — a persisting instance's own back-navigation
	     effect misreads `openEditor`'s replaceState call as "browser back was
	     pressed" and closes the editor, and its once-only local state never
	     resyncs to the new note otherwise. -->
	{#key editingNote.id}
		<NoteEditor note={editingNote} onClose={closeEditor} onOpenNote={openNoteById} />
	{/key}
{/if}
