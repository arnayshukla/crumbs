<script lang="ts">
	interface Props {
		tag: string;
		active?: boolean;
		onclick?: () => void;
	}

	let { tag, active = false, onclick }: Props = $props();
</script>

{#if onclick}
	<button
		{onclick}
		class="rounded-sm px-2 py-0.5 text-xs font-medium transition-colors {active
			? 'bg-[var(--primary)] text-white'
			: 'border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:border-[var(--primary)]'}"
		data-testid="tag-chip"
	>
		#{tag}
	</button>
{:else}
	<span
		class="rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 text-xs font-medium text-[var(--text-muted)]"
		data-testid="tag-chip"
	>
		#{tag}
	</span>
{/if}
