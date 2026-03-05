<script lang="ts">
	import { onMount } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import TaskList from '@tiptap/extension-task-list';
	import TaskItem from '@tiptap/extension-task-item';
	import Link from '@tiptap/extension-link';
	import Placeholder from '@tiptap/extension-placeholder';
	import { Markdown } from 'tiptap-markdown';

	interface Props {
		content: string;
		onUpdate: (markdown: string) => void;
		onEditor?: (editor: Editor) => void;
		placeholder?: string;
	}

	let { content, onUpdate, onEditor, placeholder = 'Take a note...' }: Props = $props();

	let element: HTMLDivElement | undefined = $state();
	let editor: Editor | undefined = $state();

	onMount(() => {
		editor = new Editor({
			element: element!,
			extensions: [
				StarterKit,
				TaskList,
				TaskItem.configure({ nested: true }),
				Link.configure({ openOnClick: false }),
				Placeholder.configure({ placeholder }),
				Markdown
			],
			content,
			onUpdate: ({ editor: e }) => {
				onUpdate(e.storage.markdown.getMarkdown());
			},
			onTransaction: () => {
				// Trigger Svelte reactivity for active state checks
				editor = editor;
			}
		});

		// Expose editor on DOM element for e2e testing
		if (element) {
			(element as any).__tiptapEditor = editor;
		}

		onEditor?.(editor);

		return () => {
			editor?.destroy();
		};
	});
</script>

<div
	bind:this={element}
	class="tiptap-wrapper prose prose-sm dark:prose-invert min-h-[100px] max-w-none px-4 py-2 text-gray-800 dark:text-gray-200"
	data-testid="tiptap-editor"
></div>

<style>
	.tiptap-wrapper :global(.tiptap) {
		outline: none;
		min-height: 80px;
	}

	.tiptap-wrapper :global(.tiptap p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		float: left;
		color: #9ca3af;
		pointer-events: none;
		height: 0;
	}

	.tiptap-wrapper :global(.tiptap ul[data-type='taskList']) {
		list-style: none;
		padding: 0;
	}

	.tiptap-wrapper :global(.tiptap ul[data-type='taskList'] li) {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.tiptap-wrapper :global(.tiptap ul[data-type='taskList'] li label) {
		margin-top: 0.25rem;
	}
</style>
