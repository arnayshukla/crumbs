<script lang="ts">
	import { allTags, selectedTag } from '$lib/stores/notes.js';

	function toggleTag(tag: string) {
		selectedTag.update((current) => (current === tag ? null : tag));
	}
</script>

{#if $allTags.length > 0}
	<div class="flex flex-wrap gap-2" data-testid="tag-filter">
		{#each $allTags as tag}
			<button
				onclick={() => toggleTag(tag)}
				class="rounded-full px-3 py-1 text-xs font-medium transition-colors {$selectedTag === tag ? 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'}"
				data-testid="tag-chip"
			>
				#{tag}
			</button>
		{/each}
	</div>
{/if}
