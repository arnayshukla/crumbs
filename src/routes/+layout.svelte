<script lang="ts">
	import '../app.css';
	import Header from '$lib/components/Layout/Header.svelte';
	import Sidebar from '$lib/components/Layout/Sidebar.svelte';
	import Toast from '$lib/components/Layout/Toast.svelte';
	import { loadNotes } from '$lib/stores/notes.js';
	import { onMount } from 'svelte';

	let { data, children } = $props();
	let sidebarOpen = $state(false);

	onMount(() => {
		loadNotes();
	});
</script>

<div class="flex min-h-screen flex-col bg-[var(--bg-base)] text-[var(--text)]">
	<Header onMenuToggle={() => (sidebarOpen = !sidebarOpen)} />
	<Sidebar open={sidebarOpen} />

	<main class="flex-1 pt-4 transition-all lg:ml-64">
		<div class="mx-auto max-w-7xl px-4">
			{@render children()}
		</div>
	</main>

	<footer class="pb-4 pt-8 text-center text-xs text-[var(--text-muted)] lg:ml-64">
		Crumbs by Bretzel v{data.appVersion} &mdash; made with 🥨 in Strasbourg
	</footer>

	<Toast />
</div>
