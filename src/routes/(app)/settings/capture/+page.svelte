<script lang="ts">
	import { onMount } from 'svelte';
	import { Check, Copy, Plus, Trash2 } from 'lucide-svelte';
	import { buildBookmarklet } from '$lib/utils/capture.js';
	import { showToast } from '$lib/stores/toast.js';
	import { page } from '$app/state';

	interface QuickCaptureToken {
		id: string;
		name: string;
		keyPrefix: string;
		createdAt: string;
		lastUsedAt: string | null;
	}

	let captureEndpoint = $state('');
	let captureOrigin = $state('');
	let desktopToken = $state<string | null>(null);
	let bookmarklet = $derived(captureOrigin && desktopToken ? buildBookmarklet(captureOrigin, desktopToken) : '');
	let captureTokens = $state<QuickCaptureToken[]>([]);
	let newTokenName = $state('My iPhone');
	let createdToken = $state<string | null>(null);
	let createdTokenId = $state<string | null>(null);
	let tokenLoading = $state(false);
	let tokenError = $state('');
	let copiedValue = $state<'endpoint' | 'token' | 'authorization' | null>(null);

	onMount(() => {
		captureOrigin = location.origin;
		captureEndpoint = `${location.origin}/api/quick-capture`;
		void loadCaptureTokens();
	});

	async function copyBookmarklet() {
		try {
			await navigator.clipboard.writeText(bookmarklet);
			showToast('Bookmarklet copied', 'success');
		} catch {
			showToast('Could not copy the bookmarklet', 'error');
		}
	}

	async function copyText(value: string, target: 'endpoint' | 'token' | 'authorization') {
		try {
			await navigator.clipboard.writeText(value);
			copiedValue = target;
			setTimeout(() => {
				if (copiedValue === target) copiedValue = null;
			}, 2_000);
			showToast(target === 'endpoint' ? 'Capture endpoint copied' : 'Capture token copied', 'success');
		} catch {
			showToast('Could not copy to the clipboard', 'error');
		}
	}

	async function loadCaptureTokens() {
		try {
			const response = await fetch('/api/settings/quick-capture-tokens');
			if (response.ok) captureTokens = await response.json();
		} catch {
			// The page remains usable for the static setup instructions while offline.
		}
	}

	async function issueCaptureToken(name: string): Promise<string | null> {
		if (!name.trim() || tokenLoading) return null;
		tokenLoading = true;
		tokenError = '';
		createdToken = null;
		createdTokenId = null;
		try {
			const response = await fetch('/api/settings/quick-capture-tokens', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: name.trim() })
			});
			const body: { id?: string; token?: string; error?: string } = await response.json();
			if (!response.ok || !body.id || !body.token) {
				tokenError = body.error ?? 'Could not create the capture token';
				return null;
			}
			createdToken = body.token;
			createdTokenId = body.id;
			await loadCaptureTokens();
			return body.token;
		} catch {
			tokenError = 'Could not connect to Crumbs';
			return null;
		} finally {
			tokenLoading = false;
		}
	}

	async function createCaptureToken(event: SubmitEvent) {
		event.preventDefault();
		const token = await issueCaptureToken(newTokenName);
		if (token) newTokenName = '';
	}

	async function createDesktopBookmarklet() {
		const token = await issueCaptureToken('Desktop bookmarklet');
		if (token) desktopToken = token;
	}

	async function revokeCaptureToken(id: string) {
		try {
			const response = await fetch(`/api/settings/quick-capture-tokens/${id}`, { method: 'DELETE' });
			if (!response.ok) {
				showToast('Could not revoke the capture token', 'error');
				return;
			}
			captureTokens = captureTokens.filter((token) => token.id !== id);
			if (createdTokenId === id) {
				createdToken = null;
				createdTokenId = null;
				desktopToken = null;
			}
			showToast('Capture token revoked', 'success');
		} catch {
			showToast('Could not revoke the capture token', 'error');
		}
	}

	function formatDate(value: string): string {
		return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
	}
</script>

<section>
	<h2 class="text-xl font-semibold">Quick capture</h2>
	<p class="mt-1 text-sm text-[var(--text-muted)]">Save a new crumb from the page or app you are already using.</p>

	<div class="mt-6 rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] p-4">
		<h3 class="font-semibold">From a desktop browser</h3>
		<p class="mt-1 text-sm text-[var(--text-muted)]">The smart bookmark saves the page title, full URL, selected text, and selected or copied images immediately—without opening another Crumbs window.</p>
		<ol class="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--text-muted)]">
			<li>Create the bookmark below, then drag it onto your browser’s bookmarks bar.</li>
			<li>On a webpage, select useful text or a group containing inline images. You can also copy an image before running it.</li>
			<li>Click <strong>Capture to Crumbs</strong>. A small message on the page confirms the save.</li>
		</ol>
		{#if bookmarklet}
			<div class="mt-4 flex flex-wrap gap-2" data-testid="desktop-bookmarklet-ready">
				<a href={bookmarklet} class="rounded-sm bg-[var(--primary)] px-4 py-2 font-medium text-white">Drag to bookmarks: Capture to Crumbs</a>
				<button class="rounded-sm border border-[var(--border)] px-4 py-2" onclick={copyBookmarklet}>Copy bookmarklet</button>
			</div>
			<p class="mt-3 text-xs text-[var(--text-muted)]">This bookmark contains a capture-only token. It can create crumbs but cannot read, change, export, or delete them. Revoke “Desktop bookmarklet” below if the bookmark is exposed.</p>
		{:else}
			<button type="button" disabled={tokenLoading} class="mt-4 flex items-center gap-2 rounded-sm bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50" onclick={createDesktopBookmarklet} data-testid="create-desktop-bookmarklet">
				<Plus size={15} /> {tokenLoading ? 'Creating…' : 'Create desktop bookmarklet'}
			</button>
		{/if}
		{#if tokenError}<p class="mt-2 text-xs text-[var(--destructive)]">{tokenError}</p>{/if}
		<p class="mt-3 text-xs text-[var(--text-muted)]">Some sites block cross-site requests. On those pages the bookmark falls back to Crumbs’ review screen in the current tab; copied image data cannot be carried through that fallback.</p>
	</div>

	<div class="mt-6 rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] p-4">
		<h3 class="font-semibold">From an Android phone or tablet</h3>
		<p class="mt-1 text-sm text-[var(--text-muted)]">Install Crumbs from Chrome’s “Install app” option, then launch it once. You can then use Share in another app and choose Crumbs. If Crumbs was installed before this feature was deployed, uninstall and reinstall it so Android registers the Share target.</p>
		<p class="mt-3 text-xs text-[var(--text-muted)]">The shared title, link, and text open as a draft. Crumbs adds a basic source tag from the website hostname, and nothing is saved until you press Save.</p>
		<p class="mt-3 text-xs text-[var(--destructive)]">iPhone and iPad do not currently support manifest-based Share targets for installed web apps, so Crumbs will not appear in their system Share menu.</p>
	</div>

	<div class="mt-6 rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] p-4">
		<h3 class="font-semibold">From an iPhone or iPad with Shortcuts</h3>
		<p class="mt-1 text-sm text-[var(--text-muted)]">A capture-only token lets your Shortcut save shared text, links, and images directly. It cannot read, edit, export, or delete your crumbs.</p>
		<p class="mt-2 text-xs text-[var(--text-muted)]">Tokens created here always save to <strong>{page.data.user?.displayName || page.data.user?.email}</strong> ({page.data.user?.email}). Use a separate token for each device or workflow so it can be revoked independently.</p>

		<form class="mt-4 flex flex-col gap-2 sm:flex-row" onsubmit={createCaptureToken}>
			<label class="sr-only" for="capture-token-name">Device name</label>
			<input id="capture-token-name" bind:value={newTokenName} maxlength="80" placeholder="Device name, e.g. My iPhone" class="flex-1 rounded-sm border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]" data-testid="capture-token-name" />
			<button type="submit" disabled={tokenLoading || !newTokenName.trim()} class="flex items-center justify-center gap-2 rounded-sm bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50" data-testid="create-capture-token">
				<Plus size={15} /> {tokenLoading ? 'Creating…' : 'Create capture token'}
			</button>
		</form>
		{#if tokenError}<p class="mt-2 text-xs text-[var(--destructive)]">{tokenError}</p>{/if}

		{#if createdToken}
			<div class="mt-4 rounded-sm border border-[var(--success-border,#a3b18a)] bg-[var(--success-bg,#f0f4e8)] p-4" data-testid="created-capture-token">
				<p class="text-sm font-semibold text-[var(--success-text,#3a5a40)]">Copy this token now—it will not be shown again.</p>
				<p class="mt-1 text-xs text-[var(--text-muted)]">Do not share the Shortcut after adding this value. You can revoke it below without signing out anywhere.</p>
				<div class="mt-3 flex items-center gap-2">
					<code class="min-w-0 flex-1 overflow-x-auto rounded-sm bg-[var(--bg-base)] px-3 py-2 text-xs" data-testid="created-capture-token-value">{createdToken}</code>
					<button type="button" class="rounded-sm border border-[var(--border)] p-2" onclick={() => copyText(createdToken!, 'token')} aria-label="Copy capture token">
						{#if copiedValue === 'token'}<Check size={15} />{:else}<Copy size={15} />{/if}
					</button>
				</div>
			</div>
		{/if}

		<h4 class="mt-5 text-sm font-semibold">Share links, text, reels, or images</h4>
		<ol class="mt-2 list-decimal space-y-2 pl-5 text-sm text-[var(--text-muted)]">
			<li>In Shortcuts, create a shortcut named <strong>Capture to Crumbs</strong>.</li>
			<li>Open its details, enable <strong>Show in Share Sheet</strong>, and accept <strong>Images</strong>, <strong>URLs</strong>, and <strong>Text</strong>.</li>
			<li>Add a <strong>Choose from Menu</strong> action with <strong>Save now</strong> and <strong>Add tags</strong>. In Add tags, use <strong>Ask for Input</strong> with the prompt “Tags (comma or space separated)” and save the result as <code>Tags</code>.</li>
			<li>For images, use <strong>Get Images from Input</strong> followed by <strong>Convert Image</strong> to JPEG. The API accepts up to 10 images.</li>
			<li>Add <strong>Get Contents of URL</strong> using the endpoint below, choose <strong>POST</strong>, and use a <strong>Form</strong> request body.</li>
			<li>Add <code>input</code> from <strong>Get Text from Input</strong>, optional <code>tags</code> from <code>Tags</code>, and <code>images</code> from the converted images. A URL inside the input is parsed automatically.</li>
			<li>Add an <code>Authorization</code> header whose value is <code>Bearer </code> followed by the token shown above. For a Form request, also add <code>Origin</code> with the app origin <code>{captureOrigin}</code>.</li>
			<li>Read <code>message</code> from <strong>Contents of URL</strong>. If it has a value, show it in <strong>Show Notification</strong>; otherwise show <strong>Capture failed</strong>.</li>
		</ol>

		<h4 class="mt-5 text-sm font-semibold">Dictate from iPhone or Apple Watch</h4>
		<ol class="mt-2 list-decimal space-y-2 pl-5 text-sm text-[var(--text-muted)]">
			<li>Create a second token above named <strong>Apple Watch</strong> and a shortcut named <strong>Voice to Crumbs</strong>.</li>
			<li>Add <strong>Dictate Text</strong>. Stop the shortcut when the dictated result is empty.</li>
			<li>Add the same <strong>Save now</strong> / <strong>Add tags</strong> menu. Tags can be dictated on the Watch.</li>
			<li>POST a <strong>JSON</strong> body to the endpoint below with <code>title</code> set to <code>Voice note</code>, <code>input</code> set to the dictated text, and <code>tags</code> set to <code>voice</code> plus any tags you entered.</li>
			<li>Add the token as the <code>Authorization</code> header and show the returned <code>message</code> as a notification.</li>
			<li>In the shortcut details, enable <strong>Show on Apple Watch</strong>. Run it from Shortcuts, Siri, a complication, or the Action button where supported.</li>
		</ol>
		<p class="mt-2 text-xs text-[var(--text-muted)]">If Dictate Text is unavailable on your Watch, use a text input prompt and choose the Watch’s Dictation input method. The Watch needs internet access through its iPhone, Wi-Fi, or cellular. Speech is transcribed in your configured dictation language; audio is not uploaded.</p>
		<div class="mt-4 space-y-2 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
			<div class="flex items-center gap-2">
				<code class="min-w-0 flex-1 break-all text-xs">{captureEndpoint}</code>
				<button type="button" class="rounded-sm border border-[var(--border)] p-2" onclick={() => copyText(captureEndpoint, 'endpoint')} aria-label="Copy capture endpoint">
					{#if copiedValue === 'endpoint'}<Check size={14} />{:else}<Copy size={14} />{/if}
				</button>
			</div>
			{#if createdToken}
				<div class="flex items-center gap-2 border-t border-[var(--border-subtle)] pt-2">
					<code class="min-w-0 flex-1 overflow-x-auto text-xs">Bearer {createdToken}</code>
					<button type="button" class="rounded-sm border border-[var(--border)] p-2" onclick={() => copyText(`Bearer ${createdToken}`, 'authorization')} aria-label="Copy authorization header">
						{#if copiedValue === 'authorization'}<Check size={14} />{:else}<Copy size={14} />{/if}
					</button>
				</div>
			{/if}
		</div>
		<p class="mt-3 text-xs text-[var(--text-muted)]">The Shortcut sends its request over HTTPS and does not open Safari or the Home Screen app. Shared URLs get a visible source link and hostname tag automatically; your optional tags are merged without duplicates. Apps such as Instagram usually share only a URL, so Crumbs does not download the reel itself.</p>
		<a class="mt-3 inline-block text-xs text-[var(--primary)] underline" href="https://support.apple.com/guide/shortcuts/launch-a-shortcut-from-another-app-apd163eb9f95/ios" target="_blank" rel="noopener noreferrer">Apple’s Share Sheet instructions</a>

		{#if captureTokens.length > 0}
			<div class="mt-5 border-t border-[var(--border-subtle)] pt-4" data-testid="capture-token-list">
				<h4 class="text-sm font-semibold">Active capture tokens</h4>
				<div class="mt-2 space-y-2">
					{#each captureTokens as token (token.id)}
						<div class="flex items-center justify-between gap-3 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2" data-testid="capture-token-item">
							<div class="min-w-0">
								<p class="truncate text-sm font-medium">{token.name} <code class="text-xs text-[var(--text-muted)]">{token.keyPrefix}…</code></p>
								<p class="text-xs text-[var(--text-muted)]">Created {formatDate(token.createdAt)}{token.lastUsedAt ? ` · Last used ${formatDate(token.lastUsedAt)}` : ' · Never used'}</p>
							</div>
							<button type="button" class="rounded-sm p-2 text-[var(--text-muted)] hover:text-[var(--destructive)]" onclick={() => revokeCaptureToken(token.id)} aria-label={`Revoke ${token.name}`} title="Revoke token">
								<Trash2 size={16} />
							</button>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</section>
