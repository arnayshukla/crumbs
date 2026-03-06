<script lang="ts">
	import SearchBar from '../SearchBar.svelte';
	import SyncIndicator from '../SyncIndicator.svelte';

	interface Props {
		onMenuToggle: () => void;
	}

	let { onMenuToggle }: Props = $props();
</script>

<header class="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-[var(--border)] bg-[var(--bg-surface)] px-4">
	<button
		onclick={onMenuToggle}
		class="rounded-sm p-2 hover:bg-[var(--border)]/10"
		aria-label="Toggle sidebar"
	>
		<svg class="h-6 w-6 text-[var(--text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
		</svg>
	</button>

	<div class="flex items-center gap-2">
		<span class="text-2xl">🥨</span>
		<h1 class="font-['Press_Start_2P'] text-lg text-[var(--primary)]">Crumbs</h1>
	</div>

	<div class="mx-4 flex-1">
		<SearchBar />
	</div>

	<div class="flex items-center gap-2">
		<SyncIndicator />
	</div>
</header>
