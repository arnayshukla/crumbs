<script lang="ts">
	import SearchBar from '../SearchBar.svelte';
	import SyncIndicator from '../SyncIndicator.svelte';
	import Menu from 'lucide-svelte/icons/menu';

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
		<Menu class="h-6 w-6 text-[var(--text)]" />
	</button>

	<div class="flex items-center gap-2">
		<h1 class="font-['Press_Start_2P'] text-lg text-[var(--primary)]">Crumbs</h1>
	</div>

	<div class="mx-4 flex-1">
		<SearchBar />
	</div>

	<div class="flex items-center gap-2">
		<SyncIndicator />
	</div>
</header>
