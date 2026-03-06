<script lang="ts">
	import { allTags, selectedTag } from '$lib/stores/notes.js';
	import TagChip from './TagChip.svelte';

	function toggleTag(tag: string) {
		selectedTag.update((current) => (current === tag ? null : tag));
	}
</script>

{#if $allTags.length > 0}
	<div class="flex flex-wrap gap-2" data-testid="tag-filter">
		{#each $allTags as tag}
			<TagChip {tag} active={$selectedTag === tag} onclick={() => toggleTag(tag)} />
		{/each}
	</div>
{/if}
