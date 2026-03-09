<script lang="ts">
	import type { ZXCVBNResult } from 'zxcvbn';

	let { password = '' }: { password: string } = $props();

	let result = $state<ZXCVBNResult | null>(null);

	$effect(() => {
		if (password.length > 0) {
			import('zxcvbn').then((mod) => {
				result = mod.default(password);
			});
		} else {
			result = null;
		}
	});

	const labels = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
	const colors = [
		'bg-[var(--destructive)]',
		'bg-[var(--destructive)]',
		'bg-[var(--primary)]',
		'bg-[var(--success-text)]',
		'bg-[var(--success-text)]'
	];
</script>

{#if result}
	<div class="mt-1 mb-2" data-testid="password-strength">
		<div class="flex gap-1">
			{#each { length: 4 } as _, i}
				<div
					class="h-1 flex-1 rounded-sm transition-colors {i <= result.score
						? colors[result.score]
						: 'bg-[var(--border-subtle)]'}"
				></div>
			{/each}
		</div>
		<p class="mt-1 text-xs text-[var(--text-muted)]">
			{labels[result.score]}
			{#if result.feedback.warning}
				— {result.feedback.warning}
			{/if}
		</p>
	</div>
{/if}
