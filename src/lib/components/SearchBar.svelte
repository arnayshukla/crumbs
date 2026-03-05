<script lang="ts">
	import { notes, loadNotes, currentFilter } from '$lib/stores/notes.js';
	import type { Note } from '$lib/types/index.js';

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
	<div class="flex items-center rounded-lg bg-gray-100 px-4 py-2">
		<svg class="mr-3 h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
		</svg>
		<input
			type="text"
			placeholder="Search crumbs..."
			bind:value={query}
			oninput={handleSearch}
			class="w-full bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-500"
			data-testid="search-input"
		/>
		{#if query}
			<button onclick={clearSearch} class="ml-2 text-gray-500 hover:text-gray-700" aria-label="Clear search">
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		{/if}
	</div>
</div>
