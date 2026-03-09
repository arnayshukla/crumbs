<script lang="ts">
	import NotesView from '$lib/components/NotesView.svelte';
	import { page } from '$app/stores';
</script>

<svelte:head>
	<title>#{$page.params.name} - Crumbs</title>
</svelte:head>

<NotesView filter="all" tag={$page.params.name} />
