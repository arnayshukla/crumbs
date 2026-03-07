<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Error - Crumbs</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-[var(--bg-base)]">
	<div class="w-full max-w-sm rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] p-8 text-center">
		<img src="/favicon.svg" alt="Crumbs" class="mx-auto h-12 w-12" />
		<h1 class="mt-4 font-['Press_Start_2P'] text-xl text-[var(--primary)]">
			{page.status}
		</h1>
		<p class="mt-4 text-sm text-[var(--text-muted)]">
			{page.error?.message ?? 'Something went wrong'}
		</p>
		<a
			href="/"
			class="mt-6 inline-block rounded-sm bg-[var(--primary)] px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-hover)]"
		>
			Back to notes
		</a>
	</div>
</div>
