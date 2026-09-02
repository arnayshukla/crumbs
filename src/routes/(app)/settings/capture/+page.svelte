<script lang="ts">
	import { onMount } from 'svelte';
	import { buildBookmarklet } from '$lib/utils/capture.js';
	import { showToast } from '$lib/stores/toast.js';

	let bookmarklet = $state('');
	let sampleCapture = $state('');
	onMount(() => {
		bookmarklet = buildBookmarklet(location.origin);
		const sample = encodeURIComponent(JSON.stringify({
			title: 'Example captured page',
			text: 'Selected text from the page',
			url: 'https://example.com/article'
		}));
		sampleCapture = `/capture#${sample}`;
	});

	async function copyBookmarklet() {
		try {
			await navigator.clipboard.writeText(bookmarklet);
			showToast('Bookmarklet copied', 'success');
		} catch {
			showToast('Could not copy the bookmarklet', 'error');
		}
	}
</script>

<section>
	<h2 class="text-xl font-semibold">Quick capture</h2>
	<p class="mt-1 text-sm text-[var(--text-muted)]">Start a new crumb from the page or app you are already using, then review it before saving.</p>

	<div class="mt-6 rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] p-4">
		<h3 class="font-semibold">From a desktop browser</h3>
		<p class="mt-1 text-sm text-[var(--text-muted)]">“Capture to Crumbs” is a special bookmark. It collects the current page title, URL, selected text, and a source tag.</p>
		<ol class="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--text-muted)]">
			<li>Show your browser’s bookmarks bar.</li>
			<li>Drag the gold button below onto that bar. If dragging is unavailable, copy it and paste it as the URL of a new bookmark.</li>
			<li>While viewing any page, optionally select useful text and click the saved bookmark.</li>
			<li>Review the prepared crumb, adjust its tags or text, and save it.</li>
		</ol>
		<div class="mt-4 flex flex-wrap gap-2">
			<a href={bookmarklet} class="rounded-sm bg-[var(--primary)] px-4 py-2 font-medium text-white">Drag to bookmarks: Capture to Crumbs</a>
			<button class="rounded-sm border border-[var(--border)] px-4 py-2" onclick={copyBookmarklet}>Copy bookmarklet</button>
			<a href={sampleCapture} class="rounded-sm px-4 py-2 hover:bg-[var(--bg-base)]">Try a sample capture</a>
		</div>
	</div>

	<div class="mt-6 rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] p-4">
		<h3 class="font-semibold">From an Android phone or tablet</h3>
		<p class="mt-1 text-sm text-[var(--text-muted)]">Install Crumbs from Chrome’s “Install app” option, then launch it once. You can then use Share in another app and choose Crumbs. If Crumbs was installed before this feature was deployed, uninstall and reinstall it so Android registers the Share target.</p>
		<p class="mt-3 text-xs text-[var(--text-muted)]">The shared title, link, and text open as a draft. Crumbs adds a basic source tag from the website hostname, and nothing is saved until you press Save.</p>
		<p class="mt-3 text-xs text-[var(--destructive)]">iPhone and iPad do not currently support manifest-based Share targets for installed web apps, so Crumbs will not appear in their system Share menu.</p>
	</div>
</section>
