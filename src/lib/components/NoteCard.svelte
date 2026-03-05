<script lang="ts">
	import { NOTE_COLORS } from '$lib/utils/colors.js';
	import { effectiveTheme } from '$lib/stores/theme.js';
	import { renderMarkdown } from '$lib/utils/markdown.js';
	import { togglePin, trashNote, archiveNote, unarchiveNote, restoreNote, deleteNote, currentFilter } from '$lib/stores/notes.js';
	import type { Note } from '$lib/types/index.js';

	interface ChecklistItem {
		text: string;
		checked: boolean;
	}

	interface Props {
		note: Note;
		onEdit: (note: Note) => void;
	}

	let { note, onEdit }: Props = $props();

	$effect(() => {
		const colors = NOTE_COLORS[note.color];
		const bg = $effectiveTheme === 'dark' ? colors.dark : colors.light;
		cardStyle = `background-color: ${bg}`;
	});

	let cardStyle = $state('');

	const renderedContent = $derived(renderMarkdown(note.content));

	const checklistItems = $derived<ChecklistItem[]>(
		note.checklistMode
			? note.content.split('\n').filter(l => l.trim()).map(line => ({
					text: line.replace(/^- \[[ x]\] /, ''),
					checked: line.startsWith('- [x] ')
				}))
			: []
	);

	function stop(fn: () => void) {
		return (e: Event) => {
			e.stopPropagation();
			fn();
		};
	}
</script>

<article
	class="group relative cursor-pointer rounded-lg border border-gray-200 p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700"
	style={cardStyle}
	onclick={() => onEdit(note)}
	onkeydown={(e) => e.key === 'Enter' && onEdit(note)}
	role="button"
	tabindex="0"
	data-testid="note-card"
	data-note-id={note.id}
>
	{#if note.title}
		<h3 class="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{note.title}</h3>
	{/if}

	{#if note.checklistMode && checklistItems.length > 0}
		<ul class="space-y-1" data-testid="note-checklist-preview">
			{#each checklistItems.slice(0, 8) as item}
				<li class="flex items-center gap-2 text-sm {item.checked ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300'}">
					<input type="checkbox" checked={item.checked} disabled class="h-3.5 w-3.5 rounded border-gray-300 text-amber-600" />
					<span class="truncate">{item.text}</span>
				</li>
			{/each}
			{#if checklistItems.length > 8}
				<li class="text-xs text-gray-400">+{checklistItems.length - 8} more</li>
			{/if}
		</ul>
	{:else if note.content}
		<div class="prose prose-sm dark:prose-invert line-clamp-6 max-w-none text-sm text-gray-700 dark:text-gray-300" data-testid="note-content-preview">
			{@html renderedContent}
		</div>
	{/if}

	{#if note.tags && note.tags.length > 0}
		<div class="mt-2 flex flex-wrap gap-1">
			{#each note.tags as tag}
				<span class="rounded-full bg-gray-200/60 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700/60 dark:text-gray-400">
					#{tag}
				</span>
			{/each}
		</div>
	{/if}

	<!-- Action buttons - show on hover -->
	<div class="absolute bottom-1 right-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
		{#if $currentFilter === 'trashed'}
			<button
				onclick={stop(() => restoreNote(note.id))}
				class="rounded-full p-1.5 hover:bg-black/10 dark:hover:bg-white/10"
				title="Restore"
				data-testid="restore-btn"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
				</svg>
			</button>
			<button
				onclick={stop(() => deleteNote(note.id))}
				class="rounded-full p-1.5 hover:bg-black/10 dark:hover:bg-white/10"
				title="Delete forever"
				data-testid="delete-forever-btn"
			>
				<svg class="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
				</svg>
			</button>
		{:else}
			<button
				onclick={stop(() => togglePin(note.id, note.pinned))}
				class="rounded-full p-1.5 hover:bg-black/10 dark:hover:bg-white/10"
				title={note.pinned ? 'Unpin' : 'Pin'}
				data-testid="pin-btn"
			>
				<svg class="h-4 w-4 {note.pinned ? 'text-amber-600' : ''}" fill={note.pinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
				</svg>
			</button>
			{#if $currentFilter === 'archived'}
				<button
					onclick={stop(() => unarchiveNote(note.id))}
					class="rounded-full p-1.5 hover:bg-black/10 dark:hover:bg-white/10"
					title="Unarchive"
					data-testid="unarchive-btn"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
					</svg>
				</button>
			{:else}
				<button
					onclick={stop(() => archiveNote(note.id))}
					class="rounded-full p-1.5 hover:bg-black/10 dark:hover:bg-white/10"
					title="Archive"
					data-testid="archive-btn"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
					</svg>
				</button>
			{/if}
			<button
				onclick={stop(() => trashNote(note.id))}
				class="rounded-full p-1.5 hover:bg-black/10 dark:hover:bg-white/10"
				title="Delete"
				data-testid="trash-btn"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
				</svg>
			</button>
		{/if}
	</div>

	<!-- Pin indicator -->
	{#if note.pinned}
		<div class="absolute right-2 top-2">
			<svg class="h-4 w-4 text-amber-600" fill="currentColor" viewBox="0 0 24 24">
				<path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
			</svg>
		</div>
	{/if}
</article>

<style>
	article :global(.prose li:has(.task-checkbox)) {
		list-style: none;
		display: flex;
		align-items: flex-start;
		gap: 0.25rem;
	}

	article :global(.prose li:has(.task-checkbox))::before {
		display: none;
	}

	article :global(.prose li:has(.task-checkbox))::marker {
		content: none;
	}

	article :global(.task-checkbox) {
		margin-top: 0.15rem;
		flex-shrink: 0;
	}
</style>
