<script lang="ts">
	import { NOTE_COLORS } from '$lib/utils/colors.js';
	import { renderMarkdown } from '$lib/utils/markdown.js';
	import { togglePin, trashNote, archiveNote, unarchiveNote, restoreNote, deleteNote, updateNote, currentFilter } from '$lib/stores/notes.js';
	import type { Note } from '$lib/types/index.js';
	import Undo2 from 'lucide-svelte/icons/undo-2';
	import Trash2 from 'lucide-svelte/icons/trash-2';
	import Bookmark from 'lucide-svelte/icons/bookmark';
	import Archive from 'lucide-svelte/icons/archive';
	import ArchiveRestore from 'lucide-svelte/icons/archive-restore';

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
		cardStyle = `background-color: ${colors.bg}`;
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

	function toggleChecklistItem(index: number) {
		const lines = note.content.split('\n');
		let checkIndex = 0;
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (line.startsWith('- [x] ') || line.startsWith('- [ ] ')) {
				if (checkIndex === index) {
					lines[i] = line.startsWith('- [x] ')
						? `- [ ] ${line.slice(6)}`
						: `- [x] ${line.slice(6)}`;
					break;
				}
				checkIndex++;
			}
		}
		updateNote(note.id, { content: lines.join('\n') });
	}
</script>

<article
	class="group relative cursor-pointer rounded-sm border border-[var(--border-subtle)] p-4 transition-all hover:border-[var(--primary)] shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)]"
	style={cardStyle}
	onclick={() => onEdit(note)}
	onkeydown={(e) => e.key === 'Enter' && onEdit(note)}
	role="button"
	tabindex="0"
	data-testid="note-card"
	data-note-id={note.id}
>
	{#if note.title}
		<h3 class="mb-2 text-sm font-semibold text-[var(--text)]">{note.title}</h3>
	{/if}

	{#if note.checklistMode && checklistItems.length > 0}
		<ul class="space-y-1" data-testid="note-checklist-preview">
			{#each checklistItems.slice(0, 8) as item, index}
				<li class="flex items-center gap-2 text-sm {item.checked ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text)]'}">
					<input
						type="checkbox"
						checked={item.checked}
						onclick={(e) => { e.stopPropagation(); toggleChecklistItem(index); }}
						class="h-3.5 w-3.5 rounded border-[var(--border-subtle)] text-[var(--primary)] cursor-pointer"
						data-testid="card-checklist-checkbox"
					/>
					<span class="truncate">{item.text}</span>
				</li>
			{/each}
			{#if checklistItems.length > 8}
				<li class="text-xs text-[var(--text-muted)]">+{checklistItems.length - 8} more</li>
			{/if}
		</ul>
	{:else if note.content}
		<div class="prose prose-sm line-clamp-6 max-w-none text-sm text-[var(--text-muted)]" data-testid="note-content-preview">
			{@html renderedContent}
		</div>
	{/if}

	{#if note.tags && note.tags.length > 0}
		<div class="mt-2 flex flex-wrap gap-1">
			{#each note.tags as tag}
				<span class="rounded-sm bg-[var(--border)]/10 px-2 py-0.5 text-xs text-[var(--text-muted)]">
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
				class="rounded-sm p-1.5 hover:bg-[var(--border)]/10"
				title="Restore"
				data-testid="restore-btn"
			>
				<Undo2 class="h-4 w-4" />
			</button>
			<button
				onclick={stop(() => deleteNote(note.id))}
				class="rounded-sm p-1.5 hover:bg-[var(--border)]/10"
				title="Delete forever"
				data-testid="delete-forever-btn"
			>
				<Trash2 class="h-4 w-4 text-[var(--destructive)]" />
			</button>
		{:else}
			<button
				onclick={stop(() => togglePin(note.id, note.pinned))}
				class="rounded-sm p-1.5 hover:bg-[var(--border)]/10"
				title={note.pinned ? 'Unpin' : 'Pin'}
				data-testid="pin-btn"
			>
				<Bookmark class="h-4 w-4 {note.pinned ? 'fill-[var(--primary)] text-[var(--primary)]' : ''}" />
			</button>
			{#if $currentFilter === 'archived'}
				<button
					onclick={stop(() => unarchiveNote(note.id))}
					class="rounded-sm p-1.5 hover:bg-[var(--border)]/10"
					title="Unarchive"
					data-testid="unarchive-btn"
				>
					<ArchiveRestore class="h-4 w-4" />
				</button>
			{:else}
				<button
					onclick={stop(() => archiveNote(note.id))}
					class="rounded-sm p-1.5 hover:bg-[var(--border)]/10"
					title="Archive"
					data-testid="archive-btn"
				>
					<Archive class="h-4 w-4" />
				</button>
			{/if}
			<button
				onclick={stop(() => trashNote(note.id))}
				class="rounded-sm p-1.5 hover:bg-[var(--border)]/10"
				title="Delete"
				data-testid="trash-btn"
			>
				<Trash2 class="h-4 w-4" />
			</button>
		{/if}
	</div>

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
