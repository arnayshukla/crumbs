<script lang="ts">
	import ColorPicker from './ColorPicker.svelte';
	import Checklist from './Checklist.svelte';
	import FormattingToolbar from './FormattingToolbar.svelte';
	import TiptapEditor from './TiptapEditor.svelte';
	import { updateNote, createNote } from '$lib/stores/notes.js';
	import { NOTE_COLORS } from '$lib/utils/colors.js';
	import type { Editor } from '@tiptap/core';
	import type { Note, NoteColor } from '$lib/types/index.js';
	import Palette from 'lucide-svelte/icons/palette';
	import ListChecks from 'lucide-svelte/icons/list-checks';
	import List from 'lucide-svelte/icons/list';
	import Code from 'lucide-svelte/icons/code';
	import Eye from 'lucide-svelte/icons/eye';

	interface Props {
		note: Note | null;
		isNew?: boolean;
		onClose: () => void;
	}

	const { note, isNew = false, onClose }: Props = $props();

	// svelte-ignore state_referenced_locally
	let title = $state(note?.title ?? '');
	// svelte-ignore state_referenced_locally
	let content = $state(note?.content ?? '');
	// svelte-ignore state_referenced_locally
	let color = $state<NoteColor>(note?.color ?? 'default');
	// svelte-ignore state_referenced_locally
	let checklistMode = $state(note?.checklistMode ?? false);
	let showColorPicker = $state(false);
	let rawMarkdownMode = $state(false);
	let textareaEl: HTMLTextAreaElement | undefined = $state();
	let tiptapEditor: Editor | undefined = $state();
	let editorTick = $state(0);

	let bgStyle = $state('');
	$effect(() => {
		const colors = NOTE_COLORS[color];
		bgStyle = `background-color: ${colors.bg}`;
	});

	async function save() {
		if (!title.trim() && !content.trim()) {
			onClose();
			return;
		}

		if (isNew) {
			await createNote({ title, content, color, checklistMode });
		} else if (note) {
			await updateNote(note.id, { title, content, color, checklistMode });
		}
		onClose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			save();
		}
	}

	function handleColorSelect(c: NoteColor) {
		color = c;
		showColorPicker = false;
	}

	function toggleMarkdownMode() {
		rawMarkdownMode = !rawMarkdownMode;
		if (rawMarkdownMode) {
			requestAnimationFrame(() => textareaEl?.focus());
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/50 pt-20 pb-10"
	onclick={save}
	onkeydown={handleKeydown}
	data-testid="note-editor-overlay"
>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="mx-4 flex w-full max-w-xl flex-col rounded-sm border border-[var(--border)]"
		style={bgStyle}
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => { e.stopPropagation(); handleKeydown(e); }}
		data-testid="note-editor"
	>
		<!-- Title -->
		<input
			type="text"
			placeholder="Title"
			bind:value={title}
			class="w-full bg-transparent px-4 pt-4 text-lg font-semibold text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
			data-testid="note-title-input"
		/>

		<!-- Content -->
		<div class="max-h-[60vh] overflow-y-auto">
			{#if checklistMode}
				<div class="px-4 py-2">
					<Checklist {content} onChange={(c) => (content = c)} />
				</div>
			{:else if rawMarkdownMode}
				<textarea
					bind:this={textareaEl}
					placeholder="Add a crumb..."
					bind:value={content}
					class="min-h-[300px] w-full resize-none bg-transparent px-4 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
					rows="12"
					data-testid="note-content-input"
				></textarea>
			{:else}
				<TiptapEditor
					{content}
					onUpdate={(md) => (content = md)}
					onEditor={(e) => (tiptapEditor = e)}
					onTransaction={() => editorTick++}
					placeholder="Add a crumb..."
				/>
			{/if}
		</div>

		<!-- Formatting toolbar -->
		{#if !rawMarkdownMode && !checklistMode}
			<FormattingToolbar editor={tiptapEditor} tick={editorTick} />
		{/if}

		<!-- Toolbar -->
		<div class="flex items-center justify-between border-t border-[var(--border-subtle)] px-2 py-2">
			<div class="flex items-center gap-1">
				<!-- Color picker toggle -->
				<div class="relative">
					<button
						onclick={() => (showColorPicker = !showColorPicker)}
						class="rounded-sm p-2 hover:bg-[var(--border)]/10"
						title="Background color"
						data-testid="color-picker-toggle"
					>
						<Palette class="h-5 w-5 text-[var(--text-muted)]" />
					</button>
					{#if showColorPicker}
						<div class="absolute left-0 bottom-full z-10 mb-2 w-[calc(100vw-4rem)] max-w-xs rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] p-2">
							<ColorPicker selected={color} onSelect={handleColorSelect} />
						</div>
					{/if}
				</div>

				<!-- Checklist mode toggle -->
				<button
					onclick={() => (checklistMode = !checklistMode)}
					class="rounded-sm p-2 hover:bg-[var(--border)]/10 {checklistMode ? 'text-[var(--primary)]' : ''}"
					title={checklistMode ? 'Switch to text' : 'Checklist mode'}
					data-testid="checklist-toggle"
				>
					{#if checklistMode}
						<ListChecks class="h-5 w-5" />
					{:else}
						<List class="h-5 w-5" />
					{/if}
				</button>

				<!-- Raw markdown mode toggle -->
				<button
					onclick={toggleMarkdownMode}
					class="rounded-sm p-2 hover:bg-[var(--border)]/10 {rawMarkdownMode ? 'text-[var(--primary)]' : ''}"
					title={rawMarkdownMode ? 'Rich text mode' : 'Markdown mode'}
					data-testid="markdown-toggle"
				>
					{#if rawMarkdownMode}
						<Code class="h-5 w-5" />
					{:else}
						<Eye class="h-5 w-5" />
					{/if}
				</button>
			</div>

			<button
				onclick={save}
				class="rounded-sm px-4 py-1 text-sm font-medium text-[var(--text)] hover:bg-[var(--border)]/10"
				data-testid="close-editor-btn"
			>
				Close
			</button>
		</div>
	</div>
</div>
