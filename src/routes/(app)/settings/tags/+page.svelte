<script lang="ts">
	import { onMount } from 'svelte';
	import type { Tag, TagManagePreview, TagManageRequest } from '$lib/types/index.js';
	import { showToast } from '$lib/stores/toast.js';
	import Pencil from 'lucide-svelte/icons/pencil';
	import Trash2 from 'lucide-svelte/icons/trash-2';
	import { tooltip } from '$lib/utils/tooltip.js';

	let tags = $state<Tag[]>([]);
	let source = $state('');
	let target = $state('');
	let preview = $state<TagManagePreview | null>(null);
	let busy = $state(false);
	let deletingTag = $state<string | null>(null);

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

	function startRename(tag: string) {
		source = tag;
		target = '';
		preview = null;
	}

	async function previewRename() {
		if (!target.trim()) return;
		preview = await post({ action: 'preview', operation: 'rename', source, target });
	}

	async function confirmRename() {
		busy = true;
		try {
			const result = await post({ action: 'rename', source, target });
			tags = result.tags;
			preview = null;
			source = '';
			showToast('Tag renamed', 'success');
		} catch {
			showToast('Tag change failed', 'error');
		} finally {
			busy = false;
		}
	}

	async function deleteTag(tag: string) {
		deletingTag = tag;
		try {
			const result = await post({ action: 'delete', source: tag });
			tags = result.tags;
			if (source === tag) {
				source = '';
				preview = null;
			}
			showToast('Tag removed', 'success');
		} catch {
			showToast('Tag removal failed', 'error');
		} finally {
			deletingTag = null;
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
				<button class="rounded-sm p-2 hover:bg-[var(--bg-base)]" aria-label={`Rename #${tag.name}`} use:tooltip={'Rename'} onclick={() => startRename(tag.name)}>
					<Pencil class="h-4 w-4" />
				</button>
				<button disabled={deletingTag === tag.name} class="rounded-sm p-2 text-[var(--destructive)] hover:bg-[var(--bg-base)] disabled:opacity-40" aria-label={`Delete #${tag.name}`} use:tooltip={'Delete'} onclick={() => deleteTag(tag.name)}>
					<Trash2 class="h-4 w-4" />
				</button>
			</div>
		{:else}
			<p class="p-4 text-sm text-[var(--text-muted)]">No tags yet.</p>
		{/each}
	</div>

	{#if source && !preview}
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
			<h3 class="font-semibold">Confirm rename</h3>
			<p class="mt-1 text-sm text-[var(--text-muted)]">This will update {preview.affected.length} owned crumb{preview.affected.length === 1 ? '' : 's'}.</p>
			<ul class="mt-3 max-h-40 overflow-auto text-sm">
				{#each preview.affected as note}<li class="py-1">{note.title || 'Untitled'}</li>{/each}
			</ul>
			<div class="mt-4 flex gap-2">
				<button disabled={busy} class="rounded-sm bg-[var(--primary)] px-4 py-2 text-white disabled:opacity-50" onclick={confirmRename}>Confirm</button>
				<button class="rounded-sm px-4 py-2" onclick={() => { preview = null; source = ''; }}>Cancel</button>
			</div>
		</div>
	{/if}
</section>
