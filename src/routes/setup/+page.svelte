<script lang="ts">
	import { goto } from '$app/navigation';

	let password = $state('');
	let confirmPassword = $state('');
	let errorMsg = $state('');
	let loading = $state(false);

	async function handleSetup(e: Event) {
		e.preventDefault();
		errorMsg = '';

		if (password.length < 8) {
			errorMsg = 'Password must be at least 8 characters';
			return;
		}

		if (password !== confirmPassword) {
			errorMsg = 'Passwords do not match';
			return;
		}

		loading = true;

		try {
			const res = await fetch('/api/auth/setup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password })
			});

			if (res.ok) {
				goto('/');
			} else {
				const data = await res.json();
				errorMsg = data.message || 'Setup failed';
			}
		} catch {
			errorMsg = 'Connection error';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Setup - Crumbs</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
	<div class="w-full max-w-sm rounded-lg bg-white p-8 shadow-md dark:bg-gray-800">
		<div class="mb-6 text-center">
			<span class="text-5xl">🥨</span>
			<h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100">Welcome to Crumbs</h1>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Set up your password to get started</p>
		</div>

		<form onsubmit={handleSetup}>
			{#if errorMsg}
				<div class="mb-4 rounded bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400" data-testid="error-message">
					{errorMsg}
				</div>
			{/if}

			<input
				type="password"
				bind:value={password}
				placeholder="Password (min 8 characters)"
				class="mb-3 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
				data-testid="password-input"
				required
			/>

			<input
				type="password"
				bind:value={confirmPassword}
				placeholder="Confirm password"
				class="mb-4 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
				data-testid="confirm-password-input"
				required
			/>

			<button
				type="submit"
				disabled={loading}
				class="w-full rounded-lg bg-amber-500 py-3 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
				data-testid="setup-btn"
			>
				{loading ? 'Setting up...' : 'Set password & start'}
			</button>
		</form>
	</div>
</div>
