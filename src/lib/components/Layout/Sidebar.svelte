<script lang="ts">
	import { currentFilter, loadNotes, allTags, selectedTag } from '$lib/stores/notes.js';
	import type { NoteFilter } from '$lib/types/index.js';

	interface Props {
		open: boolean;
	}

	let { open }: Props = $props();

	function setFilter(filter: NoteFilter) {
		selectedTag.set(null);
		loadNotes(filter);
	}

	function selectTag(tag: string | null) {
		selectedTag.set(tag);
		loadNotes('all');
	}
</script>

<aside
	class="fixed left-0 top-16 z-20 h-[calc(100vh-4rem)] w-64 transform border-r border-gray-200 bg-white transition-transform duration-200 dark:border-gray-700 dark:bg-gray-900 {open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0"
>
	<nav class="p-2">
		<ul class="space-y-1">
			<li>
				<button
					onclick={() => setFilter('all')}
					class="flex w-full items-center gap-3 rounded-full px-6 py-3 text-left text-sm transition-colors {$currentFilter === 'all' && !$selectedTag ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
					</svg>
					Notes
				</button>
			</li>
			<li>
				<button
					onclick={() => setFilter('archived')}
					class="flex w-full items-center gap-3 rounded-full px-6 py-3 text-left text-sm transition-colors {$currentFilter === 'archived' ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
					</svg>
					Archive
				</button>
			</li>
			<li>
				<button
					onclick={() => setFilter('trashed')}
					class="flex w-full items-center gap-3 rounded-full px-6 py-3 text-left text-sm transition-colors {$currentFilter === 'trashed' ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
					</svg>
					Trash
				</button>
			</li>
		</ul>

		{#if $allTags.length > 0}
			<div class="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
				<h3 class="px-6 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Tags</h3>
				<ul class="mt-2 space-y-1">
					{#each $allTags as tag}
						<li>
							<button
								onclick={() => selectTag($selectedTag === tag ? null : tag)}
								class="flex w-full items-center gap-3 rounded-full px-6 py-2 text-left text-sm transition-colors {$selectedTag === tag ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}"
							>
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
								</svg>
								#{tag}
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</nav>
</aside>
