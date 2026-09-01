<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { uiIntent } from '$lib/stores/ui-intents.js';
	import type { Note } from '$lib/types/index.js';
	import Search from 'lucide-svelte/icons/search';
	import FilePlus from 'lucide-svelte/icons/file-plus';
	import SquareCheck from 'lucide-svelte/icons/square-check';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	type PaletteItem =
		| { kind: 'command'; id: string; label: string; run: () => Promise<void> | void }
		| { kind: 'note'; id: string; label: string; note: Note };

	let { open, onClose }: Props = $props();
	let query = $state('');
	let results = $state<Note[]>([]);
	let activeIndex = $state(0);
	let input: HTMLInputElement | undefined = $state();
	let controller: AbortController | undefined;

	const commands: PaletteItem[] = [
		{ kind: 'command', id: 'new', label: 'Create crumb', run: () => openEditor({ type: 'new-note', checklist: false }) },
		{ kind: 'command', id: 'checklist', label: 'Create checklist', run: () => openEditor({ type: 'new-note', checklist: true }) },
		{ kind: 'command', id: 'home', label: 'Go to Crumbs', run: () => navigate('/') },
		{ kind: 'command', id: 'archive', label: 'Go to Archive', run: () => navigate('/archive') },
		{ kind: 'command', id: 'trash', label: 'Go to Trash', run: () => navigate('/trash') },
		{ kind: 'command', id: 'settings', label: 'Go to Settings', run: () => navigate('/settings') }
	];

	let items = $derived.by<PaletteItem[]>(() => {
		const normalized = query.trim().toLowerCase();
		const commandMatches = commands.filter((item) => !normalized || item.label.toLowerCase().includes(normalized));
		return [...commandMatches, ...results.map((note) => ({ kind: 'note' as const, id: note.id, label: note.title || 'Untitled', note }))];
	});

	$effect(() => {
		if (open) tick().then(() => input?.focus());
		else {
			query = '';
			results = [];
		}
	});

	onDestroy(() => controller?.abort());

	async function navigate(path: string) {
		onClose();
		await goto(path);
	}

	async function openEditor(intent: { type: 'new-note'; checklist: boolean } | { type: 'open-note'; noteId: string }) {
		onClose();
		if (location.pathname !== '/') await goto('/');
		uiIntent.set(intent);
	}

	async function search() {
		controller?.abort();
		activeIndex = 0;
		if (!query.trim()) {
			results = [];
			return;
		}
		controller = new AbortController();
		try {
			const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
			if (response.ok) results = await response.json();
		} catch (error) {
			if (!(error instanceof DOMException && error.name === 'AbortError')) results = [];
		}
	}

	async function choose(item: PaletteItem) {
		if (item.kind === 'command') await item.run();
		else await openEditor({ type: 'open-note', noteId: item.note.id });
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const direction = event.key === 'ArrowDown' ? 1 : -1;
			activeIndex = (activeIndex + direction + items.length) % Math.max(items.length, 1);
		} else if (event.key === 'Enter' && items[activeIndex]) {
			event.preventDefault();
			choose(items[activeIndex]);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			onClose();
		}
	}
</script>

{#if open}
	<div class="fixed inset-0 z-[70] flex justify-center bg-black/50 px-4 pt-[12vh]" role="presentation" onclick={(event) => event.target === event.currentTarget && onClose()}>
		<div class="h-fit w-full max-w-xl overflow-hidden rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] shadow-xl" role="dialog" aria-modal="true" aria-label="Command palette" tabindex="-1" onkeydown={handleKeydown}>
			<div class="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
				<Search class="h-5 w-5 text-[var(--text-muted)]" />
				<input bind:this={input} bind:value={query} oninput={search} class="w-full bg-transparent outline-none" placeholder="Search crumbs or run a command…" data-testid="command-palette-input" />
				<kbd class="text-xs text-[var(--text-muted)]">Esc</kbd>
			</div>
			<div class="max-h-80 overflow-y-auto py-2" role="listbox">
				{#each items as item, index (item.kind + item.id)}
					<button type="button" class="flex w-full items-center gap-3 px-4 py-2 text-left {index === activeIndex ? 'bg-[var(--primary)]/15 text-[var(--primary)]' : 'hover:bg-[var(--bg-base)]'}" onclick={() => choose(item)} role="option" aria-selected={index === activeIndex}>
						{#if item.kind === 'note'}<Search class="h-4 w-4" />{:else if item.id === 'checklist'}<SquareCheck class="h-4 w-4" />{:else}<FilePlus class="h-4 w-4" />{/if}
						<span class="truncate">{item.label}</span>
						{#if item.kind === 'note'}<span class="ml-auto text-xs text-[var(--text-muted)]">crumb</span>{/if}
					</button>
				{:else}<p class="px-4 py-6 text-center text-sm text-[var(--text-muted)]">No matches</p>{/each}
			</div>
		</div>
	</div>
{/if}
