<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { allTags } from '$lib/stores/notes.js';
	import TagChip from './TagChip.svelte';

	function toggleTag(tag: string) {
		const isActive = $page.url.pathname === `/tag/${tag}`;
		goto(isActive ? '/' : `/tag/${tag}`);
	}

	function isTagActive(tag: string, pathname: string): boolean {
		return pathname === `/tag/${tag}`;
	}
</script>

{#if $allTags.length > 0}
	<div class="flex gap-2 overflow-x-auto max-md:flex-nowrap md:flex-wrap" data-testid="tag-filter">
		{#each $allTags as tag}
			<TagChip {tag} active={isTagActive(tag, $page.url.pathname)} onclick={() => toggleTag(tag)} />
		{/each}
	</div>
{/if}
