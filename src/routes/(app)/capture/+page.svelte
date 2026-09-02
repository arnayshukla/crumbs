<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { PageProps } from './$types.js';
	import type { CaptureDraft, NoteColor, Tag } from '$lib/types/index.js';
	import { decodeCaptureFragment } from '$lib/utils/capture.js';
	import { createNote } from '$lib/stores/notes.js';
	import { showToast } from '$lib/stores/toast.js';
	import ColorPicker from '$lib/components/ColorPicker.svelte';

	let { form }: PageProps = $props();
	let draft = $state<CaptureDraft>(form?.draft ?? { title: '', content: '' });
	let color = $state<NoteColor>('default');
	let knownTags = $state<string[]>([]);
	let saving = $state(false);
	let fromBookmarklet = $state(false);

	onMount(() => {
		fromBookmarklet = new URL(location.href).searchParams.get('from') === 'bookmarklet';
		const fragmentDraft = decodeCaptureFragment(location.hash);
		if (fragmentDraft) draft = fragmentDraft;
		fetch('/api/tags')
			.then((response) => (response.ok ? response.json() : []))
			.then((rows: Tag[]) => (knownTags = rows.map((tag) => tag.name)))
			.catch(() => {});
	});

	function addTag(tag: string) {
		const token = `#${tag}`;
		if (!draft.content.toLowerCase().includes(token.toLowerCase())) {
			draft.content = `${draft.content}${draft.content ? '\n\n' : ''}${token}`;
		}
	}

	async function save() {
		if (saving || (!draft.title.trim() && !draft.content.trim())) return;
		saving = true;
		const created = await createNote({ ...draft, color });
		if (!created) {
			saving = false;
			return;
		}
		await goto('/', { replaceState: true });
		showToast('Crumb captured', 'success');
	}

	async function cancel() {
		if (fromBookmarklet && history.length > 1) {
			history.back();
			return;
		}
		await goto('/', { replaceState: true });
	}
</script>

<svelte:head><title>Capture - Crumbs</title></svelte:head>

<section class="mx-auto max-w-2xl py-6">
	<h2 class="text-xl font-semibold">Capture a crumb</h2>
	<p class="mt-1 text-sm text-[var(--text-muted)]">Review the shared content before saving it.</p>

	<div class="mt-6 rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] p-4">
		<input bind:value={draft.title} class="w-full bg-transparent text-lg font-semibold outline-none" placeholder="Title" data-testid="capture-title" />
		<textarea bind:value={draft.content} class="mt-3 min-h-56 w-full resize-y bg-transparent outline-none" placeholder="Add a crumb..." data-testid="capture-content"></textarea>

		{#if knownTags.length > 0}
			<div class="mt-3 flex flex-wrap gap-2">
				{#each knownTags.slice(0, 12) as tag}
					<button type="button" class="rounded-sm border border-[var(--border-subtle)] px-2 py-1 text-xs hover:border-[var(--primary)]" onclick={() => addTag(tag)}>#{tag}</button>
				{/each}
			</div>
		{/if}

		<div class="mt-4 border-t border-[var(--border-subtle)] pt-4">
			<ColorPicker selected={color} onSelect={(next) => (color = next)} />
		</div>
		<div class="mt-4 flex justify-end gap-2">
			<button type="button" class="rounded-sm px-4 py-2 hover:bg-[var(--bg-base)]" onclick={cancel}>Cancel</button>
			<button disabled={saving || (!draft.title.trim() && !draft.content.trim())} class="rounded-sm bg-[var(--primary)] px-4 py-2 font-medium text-white disabled:opacity-50" onclick={save} data-testid="capture-save">{saving ? 'Saving…' : 'Save crumb'}</button>
		</div>
	</div>
</section>
