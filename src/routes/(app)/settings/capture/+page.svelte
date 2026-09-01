<script lang="ts">
	import { onMount } from 'svelte';
	import { buildBookmarklet } from '$lib/utils/capture.js';
	import { showToast } from '$lib/stores/toast.js';

	let bookmarklet = $state('');
	onMount(() => (bookmarklet = buildBookmarklet(location.origin)));

	async function copyBookmarklet() {
		await navigator.clipboard.writeText(bookmarklet);
		showToast('Bookmarklet copied', 'success');
	}
</script>

<section>
	<h2 class="text-xl font-semibold">Quick capture</h2>
	<p class="mt-1 text-sm text-[var(--text-muted)]">Installed Crumbs can receive text and links from your phone’s Share menu.</p>

	<div class="mt-6 rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] p-4">
		<h3 class="font-semibold">Browser bookmarklet</h3>
		<p class="mt-1 text-sm text-[var(--text-muted)]">Drag the link to your bookmarks bar, or copy it and create a bookmark manually. It captures the page title, URL, and selected text.</p>
		<div class="mt-4 flex flex-wrap gap-2">
			<a href={bookmarklet} class="rounded-sm bg-[var(--primary)] px-4 py-2 font-medium text-white">Capture to Crumbs</a>
			<button class="rounded-sm border border-[var(--border)] px-4 py-2" onclick={copyBookmarklet}>Copy bookmarklet</button>
		</div>
	</div>
</section>
