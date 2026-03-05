<script lang="ts">
	// Placeholder for Phase 6 - will be connected to sync store
	let status: 'synced' | 'syncing' | 'offline' | 'error' = $state('synced');
</script>

<div class="flex items-center" title="Sync status: {status}" data-testid="sync-indicator">
	{#if status === 'synced'}
		<svg class="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 24 24">
			<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
		</svg>
	{:else if status === 'syncing'}
		<svg class="h-5 w-5 animate-spin text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
		</svg>
	{:else if status === 'offline'}
		<svg class="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
			<path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
		</svg>
	{:else}
		<svg class="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
			<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
		</svg>
	{/if}
</div>
