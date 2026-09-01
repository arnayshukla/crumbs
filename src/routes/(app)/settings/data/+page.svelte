<script lang="ts">
	import { page } from '$app/state';
	import { showToast } from '$lib/stores/toast.js';

	let personalArchive = $state<File | null>(null);
	let instanceArchive = $state<File | null>(null);
	let confirmation = $state('');
	let busy = $state(false);
	let restartRequired = $state(false);

	async function upload(path: string, file: File, confirmationValue?: string) {
		const form = new FormData();
		form.set('archive', file);
		if (confirmationValue) form.set('confirmation', confirmationValue);
		const response = await fetch(path, { method: 'POST', body: form });
		if (!response.ok) throw new Error(await response.text());
		return response.json();
	}

	async function importPersonal() {
		if (!personalArchive || !confirm('Import this archive as new copies? Existing crumbs will not be overwritten.')) return;
		busy = true;
		try {
			const result = await upload('/api/data/import', personalArchive);
			showToast(`Imported ${result.notes} crumbs and ${result.attachments} attachments`, 'success');
			personalArchive = null;
		} catch (error) {
			showToast(error instanceof Error ? error.message : 'Import failed', 'error');
		} finally {
			busy = false;
		}
	}

	async function stageRestore() {
		if (!instanceArchive || confirmation !== 'RESTORE') return;
		busy = true;
		try {
			await upload('/api/admin/restore', instanceArchive, confirmation);
			restartRequired = true;
			showToast('Restore staged; restart Crumbs to apply it', 'success');
		} catch (error) {
			showToast(error instanceof Error ? error.message : 'Restore failed', 'error');
		} finally {
			busy = false;
		}
	}
</script>

<section>
	<h2 class="text-xl font-semibold">Data</h2>
	<p class="mt-1 text-sm text-[var(--text-muted)]">Portable copies for your account and disaster recovery for administrators.</p>

	<div class="mt-6 rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] p-4">
		<h3 class="font-semibold">Your portable archive</h3>
		<p class="mt-1 text-sm text-[var(--text-muted)]">Exports your owned crumbs, preferences, and attachments as Markdown and files. Sharing relationships and credentials are excluded.</p>
		<div class="mt-4 flex flex-wrap items-center gap-3">
			<a href="/api/data/export" class="rounded-sm bg-[var(--primary)] px-4 py-2 font-medium text-white">Export my data</a>
			<label class="rounded-sm border border-[var(--border)] px-4 py-2 text-sm hover:border-[var(--primary)]">
				Choose archive
				<input type="file" accept=".zip,application/zip" class="sr-only" onchange={(event) => (personalArchive = event.currentTarget.files?.[0] ?? null)} />
			</label>
			{#if personalArchive}<span class="max-w-48 truncate text-sm text-[var(--text-muted)]">{personalArchive.name}</span><button disabled={busy} class="rounded-sm border border-[var(--border)] px-4 py-2 disabled:opacity-50" onclick={importPersonal}>Import as copies</button>{/if}
		</div>
	</div>

	{#if page.data.user?.role === 'admin'}
		<div class="mt-6 rounded-sm border border-[var(--destructive)]/50 bg-[var(--bg-surface)] p-4">
			<h3 class="font-semibold">Full-instance disaster recovery</h3>
			<p class="mt-1 text-sm text-[var(--text-muted)]">Contains the complete SQLite database and attachment directory. OAuth and Railway environment secrets are not included.</p>
			<div class="mt-4"><a href="/api/admin/backup" class="rounded-sm border border-[var(--border)] px-4 py-2">Download instance backup</a></div>
			<div class="mt-5 border-t border-[var(--border-subtle)] pt-4">
				<label class="block text-sm font-medium" for="instance-archive">Stage a full restore</label>
				<input id="instance-archive" type="file" accept=".zip,application/zip" class="mt-2 block w-full text-sm" onchange={(event) => (instanceArchive = event.currentTarget.files?.[0] ?? null)} />
				<label class="mt-3 block text-sm">Type <strong>RESTORE</strong> to confirm
					<input bind:value={confirmation} class="mt-1 block w-full rounded-sm border border-[var(--border)] bg-transparent px-3 py-2" />
				</label>
				<button disabled={busy || !instanceArchive || confirmation !== 'RESTORE'} class="mt-3 rounded-sm bg-[var(--destructive)] px-4 py-2 font-medium text-white disabled:opacity-40" onclick={stageRestore}>Validate and stage restore</button>
				{#if restartRequired}<p class="mt-3 rounded-sm bg-[var(--primary)]/15 p-3 text-sm">Restore validated and staged. Restart the application to apply it; a safety snapshot will be created automatically.</p>{/if}
			</div>
		</div>
	{/if}
</section>
