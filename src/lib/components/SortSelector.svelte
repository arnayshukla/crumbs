<script lang="ts">
	import Clock from 'lucide-svelte/icons/clock';
	import CalendarPlus from 'lucide-svelte/icons/calendar-plus';
	import Hand from 'lucide-svelte/icons/hand';
	import { sortMode, type SortMode } from '$lib/stores/sort.js';

	const modes: { value: SortMode; label: string; icon: typeof Clock }[] = [
		{ value: 'updated', label: 'Updated', icon: Clock },
		{ value: 'created', label: 'Created', icon: CalendarPlus },
		{ value: 'custom', label: 'Custom', icon: Hand }
	];
</script>

<div class="inline-flex rounded-sm border border-[var(--border-subtle)]" data-testid="sort-selector">
	{#each modes as mode}
		<button
			onclick={() => sortMode.set(mode.value)}
			class="flex items-center gap-1 px-2 py-1 text-xs transition-colors duration-150
				{$sortMode === mode.value
					? 'bg-[var(--primary)] text-white'
					: 'text-[var(--text-muted)] hover:text-[var(--text)]'}"
			data-testid="sort-{mode.value}"
			aria-label="Sort by {mode.label}"
		>
			<mode.icon class="h-3.5 w-3.5" />
			<span class="hidden sm:inline">{mode.label}</span>
		</button>
	{/each}
</div>
