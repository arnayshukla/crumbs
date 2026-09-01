import { test, expect, noteCard } from './helpers/fixtures.js';
import { ZipArchive } from 'archiver';

async function portableArchive(title: string): Promise<Buffer> {
	const sourceId = `e2e-${Date.now()}`;
	const path = `notes/0001-${sourceId}.md`;
	const now = new Date().toISOString();
	const archive = new ZipArchive({ zlib: { level: 1 } });
	const chunks: Buffer[] = [];
	archive.on('data', (chunk: Buffer) => chunks.push(chunk));
	archive.append(
		JSON.stringify({
			kind: 'crumbs-portable',
			formatVersion: 1,
			exportedAt: now,
			notes: [
				{
					sourceId,
					path,
					title,
					color: 'default',
					pinned: false,
					archived: false,
					trashed: false,
					checklistMode: false,
					sortOrder: 0,
					createdAt: now,
					updatedAt: now
				}
			],
			attachments: [],
			preferences: {}
		}),
		{ name: 'manifest.json' }
	);
	archive.append(`---\ntitle: ${JSON.stringify(title)}\n---\n\nImported content #backup`, { name: path });
	const completed = new Promise<Buffer>((resolve, reject) => {
		archive.on('end', () => resolve(Buffer.concat(chunks)));
		archive.on('error', reject);
	});
	void archive.finalize();
	return completed;
}

test.describe('Intentional feature set', () => {
	test('tag management previews and renames an inline tag', async ({ authenticatedPage: page }, testInfo) => {
		const source = `feature-${testInfo.workerIndex}-${Date.now()}`;
		const target = `${source}-renamed`;
		const created = await page.request.post('/api/notes', { data: { title: 'Tag management crumb', content: `Plan #${source}` } });
		expect(created.ok()).toBeTruthy();

		await page.goto('/settings/tags');
		const row = page.locator('div').filter({ hasText: `#${source}` }).filter({ has: page.getByRole('button', { name: 'Rename' }) }).last();
		await row.getByRole('button', { name: 'Rename' }).click();
		await page.locator('#tag-target').fill(target);
		await page.getByRole('button', { name: 'Preview' }).click();
		await expect(page.getByTestId('tag-change-preview')).toContainText('1 owned crumb');
		await page.getByTestId('tag-change-preview').getByRole('button', { name: 'Confirm' }).click();
		await expect(page.getByText(`#${target}`, { exact: true })).toBeVisible();
	});

	test('bookmarklet-style capture requires preview and explicit save', async ({ authenticatedPage: page }, testInfo) => {
		const title = `Captured ${testInfo.workerIndex}-${Date.now()}`;
		const fragment = encodeURIComponent(JSON.stringify({ title, text: 'Selected text', url: 'https://example.com/article' }));
		await page.goto(`/capture#${fragment}`);
		await expect(page.getByTestId('capture-title')).toHaveValue(title);
		await expect(page.getByTestId('capture-content')).toHaveValue(/Selected text/);
		await page.getByTestId('capture-save').click();
		await page.waitForURL(/\/#.+/);
		await expect(noteCard(page, title)).toBeVisible();
	});

	test('command palette opens notes and exposes core commands', async ({ authenticatedPage: page }, testInfo) => {
		const title = `Palette ${testInfo.workerIndex}-${Date.now()}`;
		expect((await page.request.post('/api/notes', { data: { title, content: 'searchable' } })).ok()).toBeTruthy();
		await page.goto('/');
		await page.getByTestId('command-palette-trigger').click();
		await expect(page.getByText('Create crumb', { exact: true })).toBeVisible();
		await page.getByTestId('command-palette-input').fill(title);
		await expect(page.getByRole('option', { name: new RegExp(title) })).toBeVisible();
		await page.getByRole('option', { name: new RegExp(title) }).click();
		await expect(page.getByTestId('note-editor')).toBeVisible();
	});

	test('bulk selection archives multiple crumbs together', async ({ authenticatedPage: page }, testInfo) => {
		const prefix = `Bulk ${testInfo.workerIndex}-${Date.now()}`;
		for (const suffix of ['one', 'two']) {
			expect((await page.request.post('/api/notes', { data: { title: `${prefix} ${suffix}` } })).ok()).toBeTruthy();
		}
		await page.goto('/');
		await page.getByTestId('select-notes').click();
		await noteCard(page, `${prefix} one`).click();
		await noteCard(page, `${prefix} two`).click();
		await page.getByRole('button', { name: 'Archive', exact: true }).click();
		await expect(noteCard(page, `${prefix} one`)).toHaveCount(0);
		await expect(noteCard(page, `${prefix} two`)).toHaveCount(0);
	});

	test('portable export imports as copies and admin backup streams a zip', async ({ authenticatedPage: page }, testInfo) => {
		const title = `Archive ${testInfo.workerIndex}-${Date.now()}`;
		expect((await page.request.post('/api/notes', { data: { title, content: '#backup' } })).ok()).toBeTruthy();
		const exported = await page.request.get('/api/data/export');
		expect(exported.ok()).toBeTruthy();
		expect(exported.headers()['content-type']).toContain('application/zip');
		const buffer = await exported.body();
		expect(buffer.length).toBeGreaterThan(100);

		const importedTitle = `Imported ${testInfo.workerIndex}-${Date.now()}`;
		const imported = await page.request.post('/api/data/import', {
			headers: { Origin: new URL(page.url()).origin },
			multipart: {
				archive: {
					name: 'crumbs-export.zip',
					mimeType: 'application/zip',
					buffer: await portableArchive(importedTitle)
				}
			}
		});
		const importBody = await imported.text();
		expect(imported.ok(), importBody).toBeTruthy();
		expect(JSON.parse(importBody).notes).toBe(1);

		const instance = await page.request.get('/api/admin/backup');
		expect(instance.ok()).toBeTruthy();
		expect(instance.headers()['content-type']).toContain('application/zip');
		expect((await instance.body()).length).toBeGreaterThan(100);
	});
});
