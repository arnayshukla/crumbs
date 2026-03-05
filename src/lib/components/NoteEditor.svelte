<script lang="ts">
	import ColorPicker from './ColorPicker.svelte';
	import Checklist from './Checklist.svelte';
	import { updateNote, createNote } from '$lib/stores/notes.js';
	import { renderMarkdown } from '$lib/utils/markdown.js';
	import { NOTE_COLORS } from '$lib/utils/colors.js';
	import { effectiveTheme } from '$lib/stores/theme.js';
	import type { Note, NoteColor } from '$lib/types/index.js';

	interface Props {
		note: Note | null;
		isNew?: boolean;
		onClose: () => void;
	}

	let { note, isNew = false, onClose }: Props = $props();

	let title = $state(note?.title || '');
	let content = $state(note?.content || '');
	let color = $state<NoteColor>(note?.color || 'default');
	let checklistMode = $state(note?.checklistMode || false);
	let showPreview = $state(false);
	let showColorPicker = $state(false);

	let bgStyle = $state('');
	$effect(() => {
		const colors = NOTE_COLORS[color];
		bgStyle = `background-color: ${$effectiveTheme === 'dark' ? colors.dark : colors.light}`;
	});

	const renderedContent = $derived(renderMarkdown(content));

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
		class="mx-4 w-full max-w-xl rounded-lg border border-gray-200 shadow-xl dark:border-gray-700"
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
			class="w-full bg-transparent px-4 pt-4 text-lg font-semibold text-gray-900 outline-none placeholder:text-gray-500 dark:text-gray-100"
			data-testid="note-title-input"
		/>

		<!-- Content -->
		{#if checklistMode}
			<div class="px-4 py-2">
				<Checklist {content} onChange={(c) => (content = c)} />
			</div>
		{:else if showPreview}
			<div
				class="prose prose-sm dark:prose-invert min-h-[100px] max-w-none px-4 py-2"
				data-testid="note-preview"
			>
				{@html renderedContent}
			</div>
		{:else}
			<textarea
				placeholder="Take a note..."
				bind:value={content}
				class="min-h-[100px] w-full resize-none bg-transparent px-4 py-2 text-sm text-gray-800 outline-none placeholder:text-gray-500 dark:text-gray-200"
				rows="6"
				data-testid="note-content-input"
			></textarea>
		{/if}

		<!-- Toolbar -->
		<div class="flex items-center justify-between border-t border-gray-200/50 px-2 py-2 dark:border-gray-700/50">
			<div class="flex items-center gap-1">
				<!-- Color picker toggle -->
				<div class="relative">
					<button
						onclick={() => (showColorPicker = !showColorPicker)}
						class="rounded-full p-2 hover:bg-black/10 dark:hover:bg-white/10"
						title="Background color"
						data-testid="color-picker-toggle"
					>
						<svg class="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
						</svg>
					</button>
					{#if showColorPicker}
						<div class="absolute left-0 top-full mt-2 rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
							<ColorPicker selected={color} onSelect={handleColorSelect} />
						</div>
					{/if}
				</div>

				<!-- Preview toggle -->
				<button
					onclick={() => (showPreview = !showPreview)}
					class="rounded-full p-2 hover:bg-black/10 dark:hover:bg-white/10"
					title={showPreview ? 'Edit' : 'Preview'}
					data-testid="preview-toggle"
				>
					<svg class="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						{#if showPreview}
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
						{:else}
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
						{/if}
					</svg>
				</button>

				<!-- Checklist mode toggle -->
				<button
					onclick={() => (checklistMode = !checklistMode)}
					class="rounded-full p-2 hover:bg-black/10 dark:hover:bg-white/10 {checklistMode ? 'text-amber-600' : ''}"
					title="Checklist mode"
					data-testid="checklist-toggle"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
					</svg>
				</button>
			</div>

			<button
				onclick={save}
				class="rounded px-4 py-1 text-sm font-medium text-gray-700 hover:bg-black/10 dark:text-gray-300 dark:hover:bg-white/10"
				data-testid="close-editor-btn"
			>
				Close
			</button>
		</div>
	</div>
</div>
