<script lang="ts">
	import { notes, loadNotes, currentFilter } from '$lib/stores/notes.js';
	import type { Note } from '$lib/types/index.js';
	import Search from 'lucide-svelte/icons/search';
	import X from 'lucide-svelte/icons/x';

	let query = $state('');
	let originalNotes: Note[] = [];
	let isSearching = $state(false);

	async function handleSearch() {
		if (!query.trim()) {
			if (isSearching) {
				notes.set(originalNotes);
				isSearching = false;
			}
			return;
		}

		if (!isSearching) {
			notes.subscribe((n) => (originalNotes = n))();
			isSearching = true;
		}

		const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
		if (res.ok) {
			const results = await res.json();
			notes.set(results);
		}
	}

	function clearSearch() {
		query = '';
		if (isSearching) {
			notes.set(originalNotes);
			isSearching = false;
		}
	}
</script>

<div class="relative max-w-2xl">
	<div class="flex items-center rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-2 focus-within:border-[var(--primary)]">
		<Search class="mr-3 h-5 w-5 text-[var(--text-muted)]" />
		<input
			type="text"
			placeholder="Search crumbs..."
			bind:value={query}
			oninput={handleSearch}
			class="w-full bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
			data-testid="search-input"
		/>
		{#if query}
			<button onclick={clearSearch} class="ml-2 text-[var(--text-muted)] hover:text-[var(--text)]" aria-label="Clear search">
				<X class="h-5 w-5" />
			</button>
		{/if}
	</div>
</div>
