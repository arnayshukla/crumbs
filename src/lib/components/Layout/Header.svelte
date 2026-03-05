<script lang="ts">
	import SearchBar from '../SearchBar.svelte';
	import ThemeToggle from '../ThemeToggle.svelte';
	import SyncIndicator from '../SyncIndicator.svelte';

	interface Props {
		onMenuToggle: () => void;
	}

	let { onMenuToggle }: Props = $props();
</script>

<header class="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
	<button
		onclick={onMenuToggle}
		class="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
		aria-label="Toggle sidebar"
	>
		<svg class="h-6 w-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
		</svg>
	</button>

	<div class="flex items-center gap-2">
		<span class="text-2xl">🥨</span>
		<h1 class="text-xl font-semibold text-gray-800 dark:text-gray-100">Crumbs</h1>
	</div>

	<div class="mx-4 flex-1">
		<SearchBar />
	</div>

	<div class="flex items-center gap-2">
		<SyncIndicator />
		<ThemeToggle />
	</div>
</header>
