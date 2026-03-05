<script lang="ts">
	import '../app.css';
	import Header from '$lib/components/Layout/Header.svelte';
	import Sidebar from '$lib/components/Layout/Sidebar.svelte';
	import Toast from '$lib/components/Layout/Toast.svelte';
	import { loadNotes } from '$lib/stores/notes.js';
	import '$lib/stores/theme.js';
	import { onMount } from 'svelte';

	let { children } = $props();
	let sidebarOpen = $state(false);

	onMount(() => {
		loadNotes();
	});
</script>

<div class="min-h-screen bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
	<Header onMenuToggle={() => (sidebarOpen = !sidebarOpen)} />
	<Sidebar open={sidebarOpen} />

	<main class="pt-4 transition-all lg:ml-64">
		<div class="mx-auto max-w-7xl px-4">
			{@render children()}
		</div>
	</main>

	<Toast />
</div>
