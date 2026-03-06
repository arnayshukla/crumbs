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

<div class="flex min-h-screen items-center justify-center bg-[var(--bg-base)]">
	<div class="w-full max-w-sm rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] p-8">
		<div class="mb-6 text-center">
			<span class="text-5xl">🥨</span>
			<h1 class="font-['Press_Start_2P'] text-xl text-[var(--primary)]">Crumbs</h1>
			<p class="mt-2 text-sm text-[var(--text-muted)]">Enter your password to continue</p>
		</div>

		<form onsubmit={handleLogin}>
			{#if errorMsg}
				<div class="mb-4 rounded-sm border border-red-300 bg-red-50 p-3 text-sm text-red-600" data-testid="error-message">
					{errorMsg}
				</div>
			{/if}

			<input
				type="password"
				bind:value={password}
				placeholder="Password"
				class="mb-4 w-full rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
				data-testid="password-input"
				required
			/>

			<button
				type="submit"
				disabled={loading}
				class="w-full rounded-sm bg-[var(--primary)] py-3 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-50"
				data-testid="login-btn"
			>
				{loading ? 'Signing in...' : 'Sign in'}
			</button>
		</form>
	</div>
</div>
