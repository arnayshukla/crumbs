<script lang="ts">
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
				window.location.href = '/';
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

<div class="w-full max-w-sm rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] p-8 shadow-[var(--card-shadow)]">
	<div class="mb-6 text-center">
		<span class="text-5xl">🥨</span>
		<h1 class="font-['Press_Start_2P'] text-xl text-[var(--primary)]">Welcome to Crumbs</h1>
		<p class="mt-2 text-sm text-[var(--text-muted)]">Set up your password to get started</p>
	</div>

	<form onsubmit={handleSetup}>
		{#if errorMsg}
			<div class="mb-4 rounded-sm border border-[var(--error-border)] bg-[var(--error-bg)] p-3 text-sm text-[var(--error-text)]" data-testid="error-message">
				{errorMsg}
			</div>
		{/if}

		<input
			type="password"
			bind:value={password}
			placeholder="Password (min 8 characters)"
			class="mb-3 w-full rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
			data-testid="password-input"
			required
		/>

		<input
			type="password"
			bind:value={confirmPassword}
			placeholder="Confirm password"
			class="mb-4 w-full rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
			data-testid="confirm-password-input"
			required
		/>

		<button
			type="submit"
			disabled={loading}
			class="w-full rounded-sm bg-[var(--primary)] py-3 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-50"
			data-testid="setup-btn"
		>
			{loading ? 'Setting up...' : 'Set password & start'}
		</button>
	</form>
</div>
