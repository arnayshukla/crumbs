<script lang="ts">
	import { currentFilter, loadNotes, allTags, selectedTag } from '$lib/stores/notes.js';
	import { StickyNote, Archive, Trash2, Tag } from 'lucide-svelte';
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
	class="fixed left-0 top-16 z-20 h-[calc(100vh-4rem)] w-64 transform border-r border-gray-200 bg-white transition-transform duration-200 {open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0"
>
	<nav class="p-2">
		<ul class="space-y-1">
			<li>
				<button
					onclick={() => setFilter('all')}
					class="flex w-full items-center gap-3 rounded-full px-6 py-3 text-left text-sm transition-colors {$currentFilter === 'all' && !$selectedTag ? 'bg-amber-100 text-amber-900' : 'text-gray-700 hover:bg-gray-100'}"
				>
					<StickyNote size={20} />
					Crumbs
				</button>
			</li>
			<li>
				<button
					onclick={() => setFilter('archived')}
					class="flex w-full items-center gap-3 rounded-full px-6 py-3 text-left text-sm transition-colors {$currentFilter === 'archived' ? 'bg-amber-100 text-amber-900' : 'text-gray-700 hover:bg-gray-100'}"
				>
					<Archive size={20} />
					Archive
				</button>
			</li>
			<li>
				<button
					onclick={() => setFilter('trashed')}
					class="flex w-full items-center gap-3 rounded-full px-6 py-3 text-left text-sm transition-colors {$currentFilter === 'trashed' ? 'bg-amber-100 text-amber-900' : 'text-gray-700 hover:bg-gray-100'}"
				>
					<Trash2 size={20} />
					Trash
				</button>
			</li>
		</ul>

		{#if $allTags.length > 0}
			<div class="mt-6 border-t border-gray-200 pt-4">
				<h3 class="px-6 text-xs font-semibold uppercase tracking-wider text-gray-500">Tags</h3>
				<ul class="mt-2 space-y-1">
					{#each $allTags as tag}
						<li>
							<button
								onclick={() => selectTag($selectedTag === tag ? null : tag)}
								class="flex w-full items-center gap-3 rounded-full px-6 py-2 text-left text-sm transition-colors {$selectedTag === tag ? 'bg-amber-100 text-amber-900' : 'text-gray-700 hover:bg-gray-100'}"
							>
								<Tag size={16} />
								#{tag}
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</nav>
</aside>
