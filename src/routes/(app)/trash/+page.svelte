<script lang="ts">
	import NotesView from '$lib/components/NotesView.svelte';
</script>

<svelte:head>
	<title>Trash - Crumbs</title>
</svelte:head>

<NotesView filter="trashed" />
