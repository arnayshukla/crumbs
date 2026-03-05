<script lang="ts">
	import { effectiveTheme, toggleTheme } from '$lib/stores/theme.js';
</script>

<button
	onclick={toggleTheme}
	class="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
	aria-label="Toggle dark mode"
	data-testid="theme-toggle"
>
	{#if $effectiveTheme === 'dark'}
		<svg class="h-5 w-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
			<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
		</svg>
	{:else}
		<svg class="h-5 w-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
			<path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
		</svg>
	{/if}
</button>
