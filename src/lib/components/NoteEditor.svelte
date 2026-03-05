<script lang="ts">
	import ColorPicker from './ColorPicker.svelte';
	import Checklist from './Checklist.svelte';
	import FormattingToolbar from './FormattingToolbar.svelte';
	import TiptapEditor from './TiptapEditor.svelte';
	import { updateNote, createNote } from '$lib/stores/notes.js';
	import { NOTE_COLORS } from '$lib/utils/colors.js';
	import type { Editor } from '@tiptap/core';
	import type { Note, NoteColor } from '$lib/types/index.js';

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
	class="fixed inset-0 z-40 flex items-start justify-center bg-black/50 pt-20"
	onclick={save}
	onkeydown={handleKeydown}
	data-testid="note-editor-overlay"
>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="mx-4 w-full max-w-xl rounded-lg border border-gray-200 shadow-xl"
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
			class="w-full bg-transparent px-4 pt-4 text-lg font-semibold text-gray-900 outline-none placeholder:text-gray-500"
			data-testid="note-title-input"
		/>

		<!-- Content -->
		{#if checklistMode}
			<div class="px-4 py-2">
				<Checklist {content} onChange={(c) => (content = c)} />
			</div>
		{:else if rawMarkdownMode}
			<textarea
				bind:this={textareaEl}
				placeholder="Add a crumb..."
				bind:value={content}
				class="min-h-[300px] w-full resize-none bg-transparent px-4 py-2 text-sm text-gray-800 outline-none placeholder:text-gray-500"
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

		<!-- Formatting toolbar -->
		{#if !rawMarkdownMode && !checklistMode}
			<FormattingToolbar editor={tiptapEditor} tick={editorTick} />
		{/if}

		<!-- Toolbar -->
		<div class="flex items-center justify-between border-t border-gray-200/50 px-2 py-2">
			<div class="flex items-center gap-1">
				<!-- Color picker toggle -->
				<div class="relative">
					<button
						onclick={() => (showColorPicker = !showColorPicker)}
						class="rounded-full p-2 hover:bg-black/10"
						title="Background color"
						data-testid="color-picker-toggle"
					>
						<svg class="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
						</svg>
					</button>
					{#if showColorPicker}
						<div class="absolute left-0 top-full mt-2 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
							<ColorPicker selected={color} onSelect={handleColorSelect} />
						</div>
					{/if}
				</div>

				<!-- Checklist mode toggle -->
				<button
					onclick={() => (checklistMode = !checklistMode)}
					class="rounded-full p-2 hover:bg-black/10 {checklistMode ? 'text-amber-600' : ''}"
					title="Checklist mode"
					data-testid="checklist-toggle"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
					</svg>
				</button>

				<!-- Raw markdown mode toggle -->
				<button
					onclick={toggleMarkdownMode}
					class="rounded-full p-2 hover:bg-black/10 {rawMarkdownMode ? 'text-amber-600' : ''}"
					title="Markdown mode"
					data-testid="markdown-toggle"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
					</svg>
				</button>
			</div>

			<button
				onclick={save}
				class="rounded px-4 py-1 text-sm font-medium text-gray-700 hover:bg-black/10"
				data-testid="close-editor-btn"
			>
				Close
			</button>
		</div>
	</div>
</div>
