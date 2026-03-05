<script lang="ts">
	import { goto } from '$app/navigation';

	let password = $state('');
	let errorMsg = $state('');
	let loading = $state(false);

	async function handleLogin(e: Event) {
		e.preventDefault();
		errorMsg = '';
		loading = true;

		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password })
			});

			if (res.ok) {
				goto('/');
			} else {
				const data = await res.json();
				errorMsg = data.message || 'Invalid password';
			}
		} catch {
			errorMsg = 'Connection error';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Login - Crumbs</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
	<div class="w-full max-w-sm rounded-lg bg-white p-8 shadow-md dark:bg-gray-800">
		<div class="mb-6 text-center">
			<span class="text-5xl">🥨</span>
			<h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100">Crumbs</h1>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Enter your password to continue</p>
		</div>

		<form onsubmit={handleLogin}>
			{#if errorMsg}
				<div class="mb-4 rounded bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400" data-testid="error-message">
					{errorMsg}
				</div>
			{/if}

			<input
				type="password"
				bind:value={password}
				placeholder="Password"
				class="mb-4 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
				data-testid="password-input"
				required
			/>

			<button
				type="submit"
				disabled={loading}
				class="w-full rounded-lg bg-amber-500 py-3 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
				data-testid="login-btn"
			>
				{loading ? 'Signing in...' : 'Sign in'}
			</button>
		</form>
	</div>
</div>
