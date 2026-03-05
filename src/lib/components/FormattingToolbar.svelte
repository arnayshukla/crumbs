<script lang="ts">
	import type { Editor } from '@tiptap/core';

	interface Props {
		editor: Editor | undefined;
	}

	let { editor }: Props = $props();

	function toggleLink() {
		if (!editor) return;
		if (editor.isActive('link')) {
			editor.chain().focus().unsetLink().run();
		} else {
			const url = window.prompt('Enter URL:');
			if (url) {
				editor.chain().focus().setLink({ href: url }).run();
			}
		}
	}

	const buttons = [
		{ action: () => editor?.chain().focus().undo().run(), label: '\u21A9', title: 'Undo (Ctrl+Z)', testId: 'format-undo', disabled: () => !editor?.can().undo() },
		{ action: () => editor?.chain().focus().redo().run(), label: '\u21AA', title: 'Redo (Ctrl+Shift+Z)', testId: 'format-redo', disabled: () => !editor?.can().redo() },
		{ separator: true },
		{ action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(), label: 'H1', title: 'Heading 1', testId: 'format-h1', isActive: () => editor?.isActive('heading', { level: 1 }) },
		{ action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), label: 'H2', title: 'Heading 2', testId: 'format-h2', isActive: () => editor?.isActive('heading', { level: 2 }) },
		{ action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), label: 'H3', title: 'Heading 3', testId: 'format-h3', isActive: () => editor?.isActive('heading', { level: 3 }) },
		{ action: () => editor?.chain().focus().toggleBold().run(), label: 'B', title: 'Bold (Ctrl+B)', class: 'font-bold', testId: 'format-bold', isActive: () => editor?.isActive('bold') },
		{ action: () => editor?.chain().focus().toggleItalic().run(), label: 'I', title: 'Italic (Ctrl+I)', class: 'italic', testId: 'format-italic', isActive: () => editor?.isActive('italic') },
		{ action: () => editor?.chain().focus().toggleStrike().run(), label: 'S', title: 'Strikethrough (Ctrl+Shift+X)', class: 'line-through', testId: 'format-strikethrough', isActive: () => editor?.isActive('strike') },
		{ action: () => editor?.chain().focus().toggleCode().run(), label: '<>', title: 'Inline code (Ctrl+E)', testId: 'format-code', isActive: () => editor?.isActive('code') },
		{ action: () => editor?.chain().focus().toggleCodeBlock().run(), label: '{ }', title: 'Code block', testId: 'format-code-block', isActive: () => editor?.isActive('codeBlock') },
		{ action: () => editor?.chain().focus().toggleBlockquote().run(), label: '\u201C', title: 'Blockquote', testId: 'format-blockquote', isActive: () => editor?.isActive('blockquote') },
		{ action: () => editor?.chain().focus().toggleBulletList().run(), label: '\u2022', title: 'Bullet list (Ctrl+Shift+8)', testId: 'format-bullet-list', isActive: () => editor?.isActive('bulletList') },
		{ action: () => editor?.chain().focus().toggleOrderedList().run(), label: '1.', title: 'Ordered list (Ctrl+Shift+7)', testId: 'format-ordered-list', isActive: () => editor?.isActive('orderedList') },
		{ action: () => editor?.chain().focus().toggleTaskList().run(), label: '\u2611', title: 'Task list', testId: 'format-task-list', isActive: () => editor?.isActive('taskList') },
		{ action: () => editor?.chain().focus().setHorizontalRule().run(), label: '\u2015', title: 'Horizontal rule', testId: 'format-hr' },
		{ action: toggleLink, label: '\uD83D\uDD17', title: 'Insert link (Ctrl+K)', testId: 'format-link', isActive: () => editor?.isActive('link') }
	];
</script>

<div
	class="flex flex-wrap items-center gap-0.5 border-b border-gray-200/50 px-2 py-1 dark:border-gray-700/50"
	data-testid="formatting-toolbar"
>
	{#each buttons as btn}
		{#if btn.separator}
			<div class="mx-1 h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
		{:else}
			<button
				onclick={btn.action}
				disabled={btn.disabled?.()}
				class="rounded px-2 py-1 text-xs text-gray-600 hover:bg-black/10 dark:text-gray-400 dark:hover:bg-white/10 {btn.class || ''} {btn.isActive?.() ? 'bg-black/10 dark:bg-white/10' : ''} {btn.disabled?.() ? 'opacity-30' : ''}"
				title={btn.title}
				data-testid={btn.testId}
			>
				{btn.label}
			</button>
		{/if}
	{/each}
</div>
