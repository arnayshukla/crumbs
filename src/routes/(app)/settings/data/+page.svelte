<script lang="ts">
	import { page } from '$app/state';
	import { showToast } from '$lib/stores/toast.js';

	let personalArchive = $state<File | null>(null);
	let instanceArchive = $state<File | null>(null);
	let confirmation = $state('');
	let busy = $state(false);
	let restartRequired = $state(false);
	let personalArchiveInput: HTMLInputElement;

	function fileFrom(event: Event): File | null {
		const input = event.currentTarget;
		return input instanceof HTMLInputElement ? (input.files?.[0] ?? null) : null;
	}

	async function upload(path: string, file: File, confirmationValue?: string) {
		const form = new FormData();
		form.set('archive', file);
		if (confirmationValue) form.set('confirmation', confirmationValue);
		const response = await fetch(path, { method: 'POST', body: form });
		if (!response.ok) throw new Error(await response.text());
		return response.json();
	}

	async function importPersonal() {
		if (!personalArchive) return;
		busy = true;
		try {
			const result = await upload('/api/data/import', personalArchive);
			showToast(`Imported ${result.notes} crumbs and ${result.attachments} attachments`, 'success');
			personalArchive = null;
			personalArchiveInput.value = '';
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
		<h3 class="font-semibold">Portable account export</h3>
		<p class="mt-1 text-sm text-[var(--text-muted)]">A readable copy of your owned crumbs, preferences, and attachments. Sharing relationships and credentials are excluded.</p>
		<div class="mt-4">
			<a href="/api/data/export" class="inline-block rounded-sm bg-[var(--primary)] px-4 py-2 font-medium text-white">Download portable export</a>
		</div>
		<div class="mt-5 border-t border-[var(--border-subtle)] pt-4">
			<label class="block text-sm font-medium" for="portable-archive">Import a portable export as copies</label>
			<p class="mt-1 text-xs text-[var(--text-muted)]">Select a ZIP created by “Download portable export.” Imported crumbs are added as new copies; existing crumbs are not replaced.</p>
			<input bind:this={personalArchiveInput} id="portable-archive" data-testid="portable-import-input" type="file" accept=".zip,application/zip" class="mt-3 block w-full text-sm" onchange={(event) => (personalArchive = fileFrom(event))} />
			<button data-testid="portable-import-button" disabled={busy || !personalArchive} class="mt-3 rounded-sm border border-[var(--border)] px-4 py-2 disabled:opacity-40" onclick={importPersonal}>Import as new copies</button>
		</div>
	</div>

	{#if page.data.user?.role === 'admin'}
		<div class="mt-6 rounded-sm border border-[var(--destructive)]/50 bg-[var(--bg-surface)] p-4">
			<h3 class="font-semibold">Whole-instance backup (admin only)</h3>
			<p class="mt-1 text-sm text-[var(--text-muted)]">A disaster-recovery copy of every account, crumb, sharing relationship, and attachment in this Crumbs instance. OAuth and Railway environment secrets are not included.</p>
			<div class="mt-4"><a href="/api/admin/backup" class="inline-block rounded-sm border border-[var(--border)] px-4 py-2">Download full backup</a></div>
			<div class="mt-5 border-t border-[var(--border-subtle)] pt-4">
				<label class="block text-sm font-medium" for="instance-archive">Restore a full backup</label>
				<p class="mt-1 text-xs text-[var(--destructive)]">Select only a ZIP created by “Download full backup.” After restart, it replaces all accounts, crumbs, sharing, and attachments in this instance.</p>
				<input id="instance-archive" type="file" accept=".zip,application/zip" class="mt-3 block w-full text-sm" onchange={(event) => (instanceArchive = fileFrom(event))} />
				<label class="mt-3 block text-sm">Type <strong>RESTORE</strong> to confirm
					<input bind:value={confirmation} class="mt-1 block w-full rounded-sm border border-[var(--border)] bg-transparent px-3 py-2" />
				</label>
				<button disabled={busy || !instanceArchive || confirmation !== 'RESTORE'} class="mt-3 rounded-sm bg-[var(--destructive)] px-4 py-2 font-medium text-white disabled:opacity-40" onclick={stageRestore}>Validate and stage restore</button>
				{#if restartRequired}<p class="mt-3 rounded-sm bg-[var(--primary)]/15 p-3 text-sm">Restore validated and staged. Restart the application to apply it; a safety snapshot will be created automatically.</p>{/if}
			</div>
		</div>
	{/if}
</section>
