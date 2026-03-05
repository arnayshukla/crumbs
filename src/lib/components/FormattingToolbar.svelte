<script lang="ts">
	import type { Editor } from '@tiptap/core';
	import {
		Undo2,
		Redo2,
		Heading,
		List,
		ListOrdered,
		TextQuote,
		CodeXml,
		Bold,
		Italic,
		Strikethrough,
		Code,
		Underline,
		Link,
		CornerDownLeft,
		ExternalLink,
		Trash2,
		AlignLeft,
		AlignCenter,
		AlignRight,
		AlignJustify,
		Minus,
		ChevronDown
	} from 'lucide-svelte';

	interface Props {
		tick?: number;
		editor: Editor | undefined;
	}

	let { editor, tick }: Props = $props();

	function canUndo() { void tick; return editor?.can().chain().focus().undo().run() ?? false; }
	function canRedo() { void tick; return editor?.can().chain().focus().redo().run() ?? false; }

	let openDropdown: string | null = $state(null);
	let linkUrl: string = $state('');
	let linkInput: HTMLInputElement | undefined = $state();

	function toggleDropdown(name: string) {
		if (openDropdown === name) {
			openDropdown = null;
		} else {
			openDropdown = name;
			if (name === 'link') {
				linkUrl = editor?.getAttributes('link').href ?? '';
				// Focus input after Svelte renders the popover
				requestAnimationFrame(() => linkInput?.focus());
			}
		}
	}

	function closeDropdowns() {
		openDropdown = null;
	}

	function applyLink() {
		if (!editor) return;
		const url = linkUrl.trim();
		if (url) {
			editor.chain().focus().setLink({ href: url }).run();
		}
		closeDropdowns();
	}

	function removeLink() {
		if (!editor) return;
		editor.chain().focus().unsetLink().run();
		closeDropdowns();
	}

	function openLink() {
		const href = editor?.getAttributes('link').href;
		if (href) window.open(href, '_blank', 'noopener');
	}

	const iconSize = 18;
	const chevronSize = 14;

	function btnClass(active: boolean = false, disabled: boolean = false): string {
		return `rounded p-1.5 text-gray-600 hover:bg-black/10 dark:text-gray-400 dark:hover:bg-white/10 ${active ? 'bg-black/10 dark:bg-white/10' : ''} ${disabled ? 'opacity-30' : ''}`;
	}

	function dropdownBtnClass(active: boolean = false): string {
		return `flex items-center gap-0.5 rounded p-1.5 text-gray-600 hover:bg-black/10 dark:text-gray-400 dark:hover:bg-white/10 ${active ? 'bg-black/10 dark:bg-white/10' : ''}`;
	}

	function dropdownItemClass(active: boolean = false): string {
		return `flex w-full items-center gap-2 rounded px-3 py-1.5 text-sm text-gray-700 hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10 ${active ? 'bg-black/5 dark:bg-white/10' : ''}`;
	}

	function handlePointerDown(event: PointerEvent) {
		if (!openDropdown) return;
		const target = event.target as HTMLElement;
		if (!target.closest('[data-dropdown]')) {
			closeDropdowns();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && openDropdown) {
			closeDropdowns();
		}
	}
</script>

<svelte:document onpointerdown={handlePointerDown} onkeydown={handleKeydown} />

<div
	class="flex flex-wrap items-center gap-0.5 border-b border-gray-200/50 px-2 py-1 dark:border-gray-700/50"
	data-testid="formatting-toolbar"
>
	<!-- History -->
	<button
		onclick={() => editor?.chain().focus().undo().run()}
		disabled={!canUndo()}
		class={btnClass(false, !canUndo())}
		title="Undo (Ctrl+Z)"
		data-testid="format-undo"
	>
		<Undo2 size={iconSize} />
	</button>
	<button
		onclick={() => editor?.chain().focus().redo().run()}
		disabled={!canRedo()}
		class={btnClass(false, !canRedo())}
		title="Redo (Ctrl+Shift+Z)"
		data-testid="format-redo"
	>
		<Redo2 size={iconSize} />
	</button>

	<div class="mx-1 h-4 w-px bg-gray-300 dark:bg-gray-600"></div>

	<!-- Heading dropdown -->
	<div class="relative" data-dropdown="heading">
		<button
			onclick={() => toggleDropdown('heading')}
			class={dropdownBtnClass(editor?.isActive('heading') ?? false)}
			title="Heading"
			data-testid="format-heading"
		>
			<Heading size={iconSize} />
			<ChevronDown size={chevronSize} />
		</button>
		{#if openDropdown === 'heading'}
			<div class="absolute left-0 top-full z-50 mt-1 min-w-[150px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
				<button
					onclick={() => { editor?.chain().focus().toggleHeading({ level: 1 }).run(); closeDropdowns(); }}
					class={dropdownItemClass(editor?.isActive('heading', { level: 1 }) ?? false)}
					data-testid="format-h1"
				>
					<span class="w-6 text-xs font-semibold text-gray-400">H1</span>
					<span class="font-semibold">Heading 1</span>
				</button>
				<button
					onclick={() => { editor?.chain().focus().toggleHeading({ level: 2 }).run(); closeDropdowns(); }}
					class={dropdownItemClass(editor?.isActive('heading', { level: 2 }) ?? false)}
					data-testid="format-h2"
				>
					<span class="w-6 text-xs font-semibold text-gray-400">H2</span>
					<span>Heading 2</span>
				</button>
				<button
					onclick={() => { editor?.chain().focus().toggleHeading({ level: 3 }).run(); closeDropdowns(); }}
					class={dropdownItemClass(editor?.isActive('heading', { level: 3 }) ?? false)}
					data-testid="format-h3"
				>
					<span class="w-6 text-xs font-semibold text-gray-400">H3</span>
					<span>Heading 3</span>
				</button>
			</div>
		{/if}
	</div>

	<!-- List dropdown -->
	<div class="relative" data-dropdown="list">
		<button
			onclick={() => toggleDropdown('list')}
			class={dropdownBtnClass((editor?.isActive('bulletList') || editor?.isActive('orderedList')) ?? false)}
			title="Lists"
			data-testid="format-list"
		>
			<List size={iconSize} />
			<ChevronDown size={chevronSize} />
		</button>
		{#if openDropdown === 'list'}
			<div class="absolute left-0 top-full z-50 mt-1 min-w-[170px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
				<button
					onclick={() => { editor?.chain().focus().toggleBulletList().run(); closeDropdowns(); }}
					class={dropdownItemClass(editor?.isActive('bulletList') ?? false)}
					data-testid="format-bullet-list"
				>
					<List size={iconSize} />
					<span>Bullet list</span>
				</button>
				<button
					onclick={() => { editor?.chain().focus().toggleOrderedList().run(); closeDropdowns(); }}
					class={dropdownItemClass(editor?.isActive('orderedList') ?? false)}
					data-testid="format-ordered-list"
				>
					<ListOrdered size={iconSize} />
					<span>Ordered list</span>
				</button>
			</div>
		{/if}
	</div>

	<button
		onclick={() => editor?.chain().focus().toggleBlockquote().run()}
		class={btnClass(editor?.isActive('blockquote') ?? false)}
		title="Blockquote"
		data-testid="format-blockquote"
	>
		<TextQuote size={iconSize} />
	</button>
	<button
		onclick={() => editor?.chain().focus().toggleCodeBlock().run()}
		class={btnClass(editor?.isActive('codeBlock') ?? false)}
		title="Code block"
		data-testid="format-code-block"
	>
		<CodeXml size={iconSize} />
	</button>

	<div class="mx-1 h-4 w-px bg-gray-300 dark:bg-gray-600"></div>

	<!-- Inline -->
	<button
		onclick={() => editor?.chain().focus().toggleBold().run()}
		class={btnClass(editor?.isActive('bold') ?? false)}
		title="Bold (Ctrl+B)"
		data-testid="format-bold"
	>
		<Bold size={iconSize} />
	</button>
	<button
		onclick={() => editor?.chain().focus().toggleItalic().run()}
		class={btnClass(editor?.isActive('italic') ?? false)}
		title="Italic (Ctrl+I)"
		data-testid="format-italic"
	>
		<Italic size={iconSize} />
	</button>
	<button
		onclick={() => editor?.chain().focus().toggleStrike().run()}
		class={btnClass(editor?.isActive('strike') ?? false)}
		title="Strikethrough (Ctrl+Shift+X)"
		data-testid="format-strikethrough"
	>
		<Strikethrough size={iconSize} />
	</button>
	<button
		onclick={() => editor?.chain().focus().toggleCode().run()}
		class={btnClass(editor?.isActive('code') ?? false)}
		title="Inline code (Ctrl+E)"
		data-testid="format-code"
	>
		<Code size={iconSize} />
	</button>
	<button
		onclick={() => editor?.chain().focus().toggleUnderline().run()}
		class={btnClass(editor?.isActive('underline') ?? false)}
		title="Underline (Ctrl+U)"
		data-testid="format-underline"
	>
		<Underline size={iconSize} />
	</button>

	<!-- Link popover -->
	<div class="relative" data-dropdown="link">
		<button
			onclick={() => toggleDropdown('link')}
			class={btnClass(editor?.isActive('link') ?? false)}
			title="Insert link (Ctrl+K)"
			data-testid="format-link"
		>
			<Link size={iconSize} />
		</button>
		{#if openDropdown === 'link'}
			<div class="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-2 py-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-800">
				<form
					class="flex items-center gap-1"
					onsubmit={(e) => { e.preventDefault(); applyLink(); }}
				>
					<input
						bind:this={linkInput}
						bind:value={linkUrl}
						type="url"
						placeholder="Paste a link..."
						class="w-44 bg-transparent px-1.5 py-1 text-sm text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-300 dark:placeholder:text-gray-500"
						data-testid="format-link-input"
					/>
					<button
						type="submit"
						class="rounded p-1 text-gray-400 hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-gray-300"
						title="Apply link"
						data-testid="format-link-apply"
					>
						<CornerDownLeft size={16} />
					</button>
					<div class="mx-0.5 h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
					<button
						type="button"
						onclick={openLink}
						disabled={!editor?.getAttributes('link').href}
						class="rounded p-1 text-gray-400 hover:bg-black/5 hover:text-gray-600 disabled:opacity-30 dark:hover:bg-white/10 dark:hover:text-gray-300"
						title="Open link"
						data-testid="format-link-open"
					>
						<ExternalLink size={16} />
					</button>
					<button
						type="button"
						onclick={removeLink}
						disabled={!editor?.isActive('link')}
						class="rounded p-1 text-gray-400 hover:bg-black/5 hover:text-red-500 disabled:opacity-30 dark:hover:bg-white/10 dark:hover:text-red-400"
						title="Remove link"
						data-testid="format-unlink"
					>
						<Trash2 size={16} />
					</button>
				</form>
			</div>
		{/if}
	</div>

	<div class="mx-1 h-4 w-px bg-gray-300 dark:bg-gray-600"></div>

	<!-- Align dropdown -->
	<div class="relative" data-dropdown="align">
		<button
			onclick={() => toggleDropdown('align')}
			class={dropdownBtnClass(editor?.isActive({ textAlign: 'center' }) || editor?.isActive({ textAlign: 'right' }) || editor?.isActive({ textAlign: 'justify' }) ? true : false)}
			title="Text alignment"
			data-testid="format-align"
		>
			<AlignLeft size={iconSize} />
			<ChevronDown size={chevronSize} />
		</button>
		{#if openDropdown === 'align'}
			<div class="absolute left-0 top-full z-50 mt-1 min-w-[150px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
				<button
					onclick={() => { editor?.chain().focus().setTextAlign('left').run(); closeDropdowns(); }}
					class={dropdownItemClass(editor?.isActive({ textAlign: 'left' }) ?? false)}
					data-testid="format-align-left"
				>
					<AlignLeft size={iconSize} />
					<span>Left</span>
				</button>
				<button
					onclick={() => { editor?.chain().focus().setTextAlign('center').run(); closeDropdowns(); }}
					class={dropdownItemClass(editor?.isActive({ textAlign: 'center' }) ?? false)}
					data-testid="format-align-center"
				>
					<AlignCenter size={iconSize} />
					<span>Center</span>
				</button>
				<button
					onclick={() => { editor?.chain().focus().setTextAlign('right').run(); closeDropdowns(); }}
					class={dropdownItemClass(editor?.isActive({ textAlign: 'right' }) ?? false)}
					data-testid="format-align-right"
				>
					<AlignRight size={iconSize} />
					<span>Right</span>
				</button>
				<button
					onclick={() => { editor?.chain().focus().setTextAlign('justify').run(); closeDropdowns(); }}
					class={dropdownItemClass(editor?.isActive({ textAlign: 'justify' }) ?? false)}
					data-testid="format-align-justify"
				>
					<AlignJustify size={iconSize} />
					<span>Justify</span>
				</button>
			</div>
		{/if}
	</div>

	<div class="mx-1 h-4 w-px bg-gray-300 dark:bg-gray-600"></div>

	<!-- Insert -->
	<button
		onclick={() => editor?.chain().focus().setHorizontalRule().run()}
		class={btnClass()}
		title="Horizontal rule"
		data-testid="format-hr"
	>
		<Minus size={iconSize} />
	</button>
</div>
