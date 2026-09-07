<script lang="ts">
	import { onMount } from 'svelte';
	import { Check, Copy, Plus, Trash2 } from 'lucide-svelte';
	import { buildBookmarklet } from '$lib/utils/capture.js';
	import {
		APPLE_SHORTCUTS,
		type AppleShortcutKind
	} from '$lib/utils/apple-shortcuts.js';
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
	let preparingShortcut = $state<AppleShortcutKind | null>(null);
	let preparedShortcut = $state<AppleShortcutKind | null>(null);
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

	async function prepareAppleShortcut(kind: AppleShortcutKind) {
		if (preparingShortcut) return;
		preparingShortcut = kind;
		const token = await issueCaptureToken(APPLE_SHORTCUTS[kind].tokenName);
		preparingShortcut = null;
		if (!token) return;
		preparedShortcut = kind;
		showToast('Setup token created — copy the endpoint and token, then install', 'success');
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
		<p class="mt-3 text-xs text-[var(--text-muted)]">Shared text, links, and selected images save immediately to your signed-in account. Crumbs adds type and source tags automatically and confirms the capture in the app.</p>
		<p class="mt-2 text-xs text-[var(--text-muted)]">Android capture currently requires a connection. If it fails, Crumbs shows an error and does not silently queue a duplicate; reconnect and share the item again.</p>
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
				<p class="text-sm font-semibold text-[var(--success-text,#3a5a40)]">Copy both setup values now.</p>
				<p class="mt-1 text-xs text-[var(--text-muted)]">The token will not be shown again. The installer asks for the endpoint first and token second.</p>
				<div class="mt-3 flex items-center gap-2">
					<code class="min-w-0 flex-1 break-all rounded-sm bg-[var(--bg-base)] px-3 py-2 text-xs">{captureEndpoint}</code>
					<button type="button" class="rounded-sm border border-[var(--border)] p-2" onclick={() => copyText(captureEndpoint, 'endpoint')} aria-label="Copy capture endpoint">
						{#if copiedValue === 'endpoint'}<Check size={15} />{:else}<Copy size={15} />{/if}
					</button>
				</div>
				<div class="mt-3 flex items-center gap-2">
					<code class="min-w-0 flex-1 overflow-x-auto rounded-sm bg-[var(--bg-base)] px-3 py-2 text-xs" data-testid="created-capture-token-value">{createdToken}</code>
					<button type="button" class="rounded-sm border border-[var(--border)] p-2" onclick={() => copyText(createdToken!, 'token')} aria-label="Copy capture token">
						{#if copiedValue === 'token'}<Check size={15} />{:else}<Copy size={15} />{/if}
					</button>
				</div>
			</div>
		{/if}

		<div class="mt-5 grid gap-4 lg:grid-cols-2">
			<article class="rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4" data-testid="share-shortcut-card">
				<h4 class="text-sm font-semibold">Capture to Crumbs</h4>
				<p class="mt-1 text-xs text-[var(--text-muted)]">Shares text, URLs, reels, and up to ten images from iPhone or iPad. You can save immediately or add optional tags.</p>
				<ol class="mt-3 list-decimal space-y-1 pl-5 text-xs text-[var(--text-muted)]">
					<li>Create the two private setup values.</li>
					<li>Copy both values, then install and paste them when Apple asks.</li>
					<li>Enable <strong>Show in Share Sheet</strong> if Apple does not enable it automatically.</li>
				</ol>
				<div class="mt-4 flex flex-wrap gap-2">
					<button type="button" disabled={preparingShortcut !== null} class="rounded-sm bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50" onclick={() => prepareAppleShortcut('share')} data-testid="prepare-share-shortcut">1. {preparingShortcut === 'share' ? 'Creating…' : 'Create setup token'}</button>
					<a class="rounded-sm border border-[var(--border)] px-3 py-2 text-sm" href={APPLE_SHORTCUTS.share.installUrl}>2. Install Shortcut</a>
				</div>
				{#if preparedShortcut === 'share'}<p class="mt-2 text-xs text-[var(--success-text,#3a5a40)]">Setup values are ready above.</p>{/if}
			</article>

			<article class="rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4" data-testid="voice-shortcut-card">
				<h4 class="text-sm font-semibold">Voice to Crumbs</h4>
				<p class="mt-1 text-xs text-[var(--text-muted)]">Dictates a thought on iPhone or Apple Watch, optionally dictates tags, and saves only the transcript with <code>#voice</code>.</p>
				<ol class="mt-3 list-decimal space-y-1 pl-5 text-xs text-[var(--text-muted)]">
					<li>Create a separate Apple Watch token.</li>
					<li>Copy the endpoint and token, then install and paste them.</li>
					<li>Enable <strong>Show on Apple Watch</strong>, then run it from Siri, Shortcuts, a complication, or the Action button.</li>
				</ol>
				<div class="mt-4 flex flex-wrap gap-2">
					<button type="button" disabled={preparingShortcut !== null} class="rounded-sm bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50" onclick={() => prepareAppleShortcut('voice')} data-testid="prepare-voice-shortcut">1. {preparingShortcut === 'voice' ? 'Creating…' : 'Create Watch token'}</button>
					<a class="rounded-sm border border-[var(--border)] px-3 py-2 text-sm" href={APPLE_SHORTCUTS.voice.installUrl}>2. Install Shortcut</a>
				</div>
				{#if preparedShortcut === 'voice'}<p class="mt-2 text-xs text-[var(--success-text,#3a5a40)]">Watch setup values are ready above.</p>{/if}
			</article>
		</div>
		<p class="mt-3 text-xs text-[var(--text-muted)]">The public installers are signed by Apple and contain no Crumbs account, domain, or token. To rotate a token, revoke the old one below, create a replacement, and reinstall the Shortcut with the new values.</p>
		<p class="mt-2 text-xs text-[var(--text-muted)]">Apple Watch must have connectivity through its paired iPhone, Wi-Fi, or cellular. Voice uses the configured dictation language and stores text—not an audio recording.</p>
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
