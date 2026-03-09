<script lang="ts">
	import NotesView from '$lib/components/NotesView.svelte';
</script>

<svelte:head>
	<title>Archive - Crumbs</title>
</svelte:head>

<NotesView filter="archived" />
