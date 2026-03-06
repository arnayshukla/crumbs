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
				class="rounded-sm px-3 py-1 text-xs font-medium transition-colors {$selectedTag === tag ? 'bg-[var(--primary)] text-white' : 'border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:border-[var(--primary)]'}"
				data-testid="tag-chip"
			>
				#{tag}
			</button>
		{/each}
	</div>
{/if}
