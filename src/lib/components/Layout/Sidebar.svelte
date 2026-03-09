<script lang="ts">
	import { page } from '$app/stores';
	import { allTags } from '$lib/stores/notes.js';
	import { StickyNote, Archive, Trash2, Tag, Settings } from 'lucide-svelte';

	interface Props {
		open: boolean;
		onClose?: () => void;
		appVersion?: string;
	}

	let { open, onClose, appVersion }: Props = $props();

	function closeMobile() {
		if (window.matchMedia('(max-width: 1023px)').matches) {
			onClose?.();
		}
	}

	const navItems = [
		{ href: '/', label: 'Crumbs', icon: StickyNote, match: (p: string) => p === '/' },
		{ href: '/archive', label: 'Archive', icon: Archive, match: (p: string) => p === '/archive' },
		{ href: '/trash', label: 'Trash', icon: Trash2, match: (p: string) => p === '/trash' }
	];
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 top-16 z-10 bg-black/30 lg:hidden"
		onclick={onClose}
		onkeydown={(e) => { if (e.key === 'Escape') onClose?.(); }}
	></div>
{/if}

<aside
	class="fixed left-0 top-16 z-20 h-[calc(100vh-4rem)] w-64 transform border-r border-[var(--border)] bg-[var(--bg-surface)] transition-transform duration-200 {open ? 'translate-x-0' : '-translate-x-full'}"
>
	<nav class="p-2">
		<ul class="space-y-1">
			{#each navItems as item}
				<li>
					<a
						href={item.href}
						onclick={closeMobile}
						class="flex w-full items-center gap-3 rounded-sm px-6 py-3 text-left text-sm transition-colors {item.match($page.url.pathname) ? 'bg-[var(--primary)]/15 text-[var(--primary)]' : 'text-[var(--text)] hover:bg-[var(--bg-base)]'}"
					>
						<item.icon size={20} />
						{item.label}
					</a>
				</li>
			{/each}
		</ul>

		{#if $allTags.length > 0}
			<div class="mt-6 border-t border-[var(--border-subtle)] pt-4">
				<h3 class="px-6 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Tags</h3>
				<ul class="mt-2 space-y-1">
					{#each $allTags as tag}
						<li>
							<a
								href="/tag/{tag}"
								onclick={closeMobile}
								class="flex w-full items-center gap-3 rounded-sm px-6 py-2 text-left text-sm transition-colors {$page.url.pathname === `/tag/${tag}` ? 'bg-[var(--primary)]/15 text-[var(--primary)]' : 'text-[var(--text)] hover:bg-[var(--bg-base)]'}"
							>
								<Tag size={16} />
								#{tag}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</nav>
	<div class="absolute bottom-0 left-0 w-full border-t border-[var(--border-subtle)]">
		<a
			href="/settings"
			class="flex w-full items-center gap-3 px-6 py-3 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--primary)]"
			onclick={closeMobile}
			data-testid="settings-link"
		>
			<Settings size={16} />
			Settings
		</a>
		{#if appVersion}
			<div class="border-t border-[var(--border-subtle)] px-6 py-2 text-right text-xs text-[var(--text-muted)]">
				v{appVersion}
			</div>
		{/if}
	</div>
</aside>
