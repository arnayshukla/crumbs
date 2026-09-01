<script lang="ts">
	import { onMount } from 'svelte';
	import type { Tag, TagManagePreview, TagManageRequest } from '$lib/types/index.js';
	import { showToast } from '$lib/stores/toast.js';

	let tags = $state<Tag[]>([]);
	let source = $state('');
	let target = $state('');
	let operation = $state<'rename' | 'delete'>('rename');
	let preview = $state<TagManagePreview | null>(null);
	let busy = $state(false);

	async function requestTags() {
		const response = await fetch('/api/tags');
		if (!response.ok) throw new Error('Failed to load tags');
		tags = await response.json();
	}

	onMount(() => {
		requestTags().catch(() => showToast('Failed to load tags', 'error'));
	});

	async function post(body: TagManageRequest) {
		const response = await fetch('/api/tags', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!response.ok) throw new Error(await response.text());
		return response.json();
	}

	async function showPreview(tag: string, nextOperation: 'rename' | 'delete') {
		source = tag;
		target = '';
		operation = nextOperation;
		if (nextOperation === 'delete') {
			preview = await post({ action: 'preview', operation: 'delete', source: tag });
		}
	}

	async function previewRename() {
		if (!target.trim()) return;
		preview = await post({ action: 'preview', operation: 'rename', source, target });
	}

	async function confirmChange() {
		busy = true;
		try {
			const result = operation === 'rename'
				? await post({ action: 'rename', source, target })
				: await post({ action: 'delete', source });
			tags = result.tags;
			preview = null;
			source = '';
			showToast(operation === 'rename' ? 'Tag renamed' : 'Tag removed', 'success');
		} catch {
			showToast('Tag change failed', 'error');
		} finally {
			busy = false;
		}
	}
</script>

<section>
	<h2 class="text-xl font-semibold text-[var(--text)]">Tags</h2>
	<p class="mt-1 text-sm text-[var(--text-muted)]">Tags remain part of your crumb text. Changes below update only crumbs you own.</p>

	<div class="mt-6 overflow-hidden rounded-sm border border-[var(--border)] bg-[var(--bg-surface)]">
		{#each tags as tag (tag.id)}
			<div class="flex items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-3 last:border-0">
				<span class="min-w-0 flex-1 truncate font-medium text-[var(--text)]">#{tag.name}</span>
				<span class="text-xs text-[var(--text-muted)]">{tag.usageCount ?? 0} crumbs</span>
				<button class="rounded-sm px-2 py-1 text-sm hover:bg-[var(--bg-base)]" onclick={() => showPreview(tag.name, 'rename')}>Rename</button>
				<button class="rounded-sm px-2 py-1 text-sm text-[var(--destructive)] hover:bg-[var(--bg-base)]" onclick={() => showPreview(tag.name, 'delete')}>Delete</button>
			</div>
		{:else}
			<p class="p-4 text-sm text-[var(--text-muted)]">No tags yet.</p>
		{/each}
	</div>

	{#if source && operation === 'rename' && !preview}
		<div class="mt-4 rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] p-4">
			<label class="block text-sm font-medium" for="tag-target">Rename #{source} to</label>
			<div class="mt-2 flex gap-2">
				<input id="tag-target" bind:value={target} class="min-w-0 flex-1 rounded-sm border border-[var(--border)] bg-transparent px-3 py-2" placeholder="new-tag" />
				<button class="rounded-sm bg-[var(--primary)] px-4 py-2 text-white" onclick={previewRename}>Preview</button>
				<button class="rounded-sm px-3 py-2" onclick={() => (source = '')}>Cancel</button>
			</div>
		</div>
	{/if}

	{#if preview}
		<div class="mt-4 rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] p-4" data-testid="tag-change-preview">
			<h3 class="font-semibold">Confirm {operation}</h3>
			<p class="mt-1 text-sm text-[var(--text-muted)]">This will update {preview.affected.length} owned crumb{preview.affected.length === 1 ? '' : 's'}.</p>
			<ul class="mt-3 max-h-40 overflow-auto text-sm">
				{#each preview.affected as note}<li class="py-1">{note.title || 'Untitled'}</li>{/each}
			</ul>
			<div class="mt-4 flex gap-2">
				<button disabled={busy} class="rounded-sm bg-[var(--destructive)] px-4 py-2 text-white disabled:opacity-50" onclick={confirmChange}>Confirm</button>
				<button class="rounded-sm px-4 py-2" onclick={() => { preview = null; source = ''; }}>Cancel</button>
			</div>
		</div>
	{/if}
</section>
