<script lang="ts">
	interface Props {
		tags: string[];
		activeIndex?: number;
		onSelect: (tag: string) => void;
	}

	let { tags, activeIndex = 0, onSelect }: Props = $props();
</script>

{#if tags.length > 0}
	<div
		class="absolute z-50 mt-1 min-w-40 overflow-hidden rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] py-1 shadow-[var(--card-shadow-hover)]"
		role="listbox"
		data-testid="tag-suggestions"
	>
		{#each tags as tag, index}
			<button
				type="button"
				class="block w-full px-3 py-2 text-left text-sm {index === activeIndex ? 'bg-[var(--primary)]/15 text-[var(--primary)]' : 'text-[var(--text)] hover:bg-[var(--bg-base)]'}"
				onpointerdown={(event) => event.preventDefault()}
				onclick={() => onSelect(tag)}
				role="option"
				aria-selected={index === activeIndex}
			>
				#{tag}
			</button>
		{/each}
	</div>
{/if}
