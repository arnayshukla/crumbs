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
		await page.getByRole('button', { name: `Rename #${source}` }).click();
		await page.locator('#tag-target').fill(target);
		await page.getByRole('button', { name: 'Preview' }).click();
		await expect(page.getByTestId('tag-change-preview')).toContainText('1 owned crumb');
		await page.getByTestId('tag-change-preview').getByRole('button', { name: 'Confirm' }).click();
		await expect(page.getByText(`#${target}`, { exact: true })).toBeVisible();
	});

	test('tags delete immediately without a confirmation step', async ({ authenticatedPage: page }, testInfo) => {
		const source = `delete-${testInfo.workerIndex}-${Date.now()}`;
		const created = await page.request.post('/api/notes', { data: { title: 'Temporary tag', content: `#${source}` } });
		expect(created.ok()).toBeTruthy();

		await page.goto('/settings/tags');
		const deleteButton = page.getByRole('button', { name: `Delete #${source}` });
		await expect(deleteButton).toBeVisible();
		await deleteButton.click();
		await expect(deleteButton).toHaveCount(0);
		await expect(page.getByTestId('tag-change-preview')).toHaveCount(0);
	});

	test('bookmarklet-style capture requires preview and explicit save', async ({ authenticatedPage: page }, testInfo) => {
		const title = `Captured ${testInfo.workerIndex}-${Date.now()}`;
		const fragment = encodeURIComponent(JSON.stringify({ title, text: 'Selected text', url: 'https://example.com/article' }));
		await page.goto(`/capture#${fragment}`);
		await expect(page.getByTestId('capture-title')).toHaveValue(title);
		await expect(page.getByTestId('capture-content')).toHaveValue(/Selected text/);
		await expect(page.getByTestId('capture-content')).toHaveValue(
			/<https:\/\/example\.com\/article> · #text #link #example/
		);

		let releaseStaleResponse: () => void = () => {};
		let staleResponseCaptured: () => void = () => {};
		const staleReady = new Promise<void>((resolve) => (staleResponseCaptured = resolve));
		const releaseStale = new Promise<void>((resolve) => (releaseStaleResponse = resolve));
		await page.route('**/api/notes?filter=all', async (route) => {
			const response = await route.fetch();
			staleResponseCaptured();
			await releaseStale;
			await route.fulfill({ response });
		});

		await page.getByTestId('capture-save').click();
		await page.waitForURL((url) => url.pathname === '/' && !url.hash);
		await staleReady;
		await expect(page.getByTestId('note-editor')).toHaveCount(0);
		const capturedCard = noteCard(page, title);
		await expect(capturedCard).toBeVisible();
		await expect(page.getByTestId('toast')).toContainText('Crumb captured');

		await capturedCard.hover();
		await capturedCard.getByTestId('trash-btn').click();
		await expect(capturedCard).toHaveCount(0);
		releaseStaleResponse();
		await page.waitForTimeout(500);
		await expect(capturedCard).toHaveCount(0);
		await expect(page.getByTestId('toast')).toHaveCount(0, { timeout: 5_000 });
	});

	test('smart desktop bookmarklet is generated with a revocable capture token', async ({ authenticatedPage: page }) => {
		await page.goto('/settings/capture');
		await page.getByTestId('create-desktop-bookmarklet').click();
		const ready = page.getByTestId('desktop-bookmarklet-ready');
		await expect(ready).toBeVisible();
		const href = await ready.getByRole('link', { name: /Drag to bookmarks/ }).getAttribute('href');
		expect(href).toContain('/api/quick-capture');
		expect(href).toContain('navigator.clipboard.read');
		expect(href).toContain("F.append('imageUrls',u)");
		expect(href).not.toContain('window.open');

		const preflight = await page.request.fetch('/api/quick-capture', {
			method: 'OPTIONS',
			headers: {
				Origin: 'https://example.com',
				'Access-Control-Request-Method': 'POST',
				'Access-Control-Request-Headers': 'authorization,idempotency-key'
			}
		});
		expect(preflight.status()).toBe(204);
		expect(preflight.headers()['access-control-allow-origin']).toBe('*');
	});

	test('iPhone Shortcut input opens a parsed draft', async ({ authenticatedPage: page }) => {
		const shared = encodeURIComponent('Interesting reel\nhttps://www.instagram.com/reel/example/');
		await page.goto(`/capture#share=${shared}`);
		await expect(page.getByTestId('capture-title')).toHaveValue('Interesting reel');
		await expect(page.getByTestId('capture-content')).toHaveValue(
			'<https://www.instagram.com/reel/example/> · #link #reel #instagram'
		);
	});

	test('capture-only token saves shared input and cannot read notes', async ({ authenticatedPage: page }, testInfo) => {
		const tokenName = `iPhone ${testInfo.workerIndex}-${Date.now()}`;
		await page.goto('/settings/capture');
		await page.getByTestId('capture-token-name').fill(tokenName);
		await page.getByTestId('create-capture-token').click();
		const tokenDisplay = page.getByTestId('created-capture-token-value');
		await expect(tokenDisplay).toBeVisible();
		const token = (await tokenDisplay.textContent())?.trim();
		expect(token).toMatch(/^crumbs_capture_[a-f0-9]{64}$/);

		const unauthorized = await page.request.post('/api/quick-capture', {
			data: { input: 'Should not save' }
		});
		expect(unauthorized.status()).toBe(401);

		const emptyCapture = await page.request.post('/api/quick-capture', {
			headers: { Authorization: `Bearer ${token}` },
			data: { input: '' }
		});
		expect(emptyCapture.status()).toBe(400);

		const captureTitle = `Interesting reel ${Date.now()}`;
		const captured = await page.request.post('/api/quick-capture', {
			headers: { Authorization: `Bearer ${token}` },
			data: { input: `${captureTitle}\nhttps://www.instagram.com/reel/example/`, tags: 'Work, #later work' }
		});
		expect(captured.status()).toBe(201);
		expect(await captured.json()).toMatchObject({ message: 'Crumb captured', crumb: { title: captureTitle } });

		const forbiddenRead = await page.request.get('/api/notes', {
			headers: { Authorization: `Bearer ${token}` }
		});
		expect(forbiddenRead.status()).toBe(401);

		const notesResponse = await page.request.get('/api/notes');
		const capturedNote = ((await notesResponse.json()) as Array<{ title: string; content: string }>).find(
			(note) => note.title === captureTitle
		);
		expect(capturedNote?.content).toContain(
			'<https://www.instagram.com/reel/example/> · #link #reel #instagram #work #later'
		);

		const imageTitle = `Shared image ${Date.now()}`;
		const imageCapture = await page.request.post('/api/quick-capture', {
			headers: {
				Authorization: `Bearer ${token}`,
				Origin: new URL(page.url()).origin
			},
			multipart: {
				title: imageTitle,
				tags: 'photos work',
				images: {
					name: 'shortcut.png',
					mimeType: 'image/png',
					buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
				}
			}
		});
		expect(imageCapture.status(), await imageCapture.text()).toBe(201);
		const imageNotes = (await (await page.request.get('/api/notes')).json()) as Array<{
			title: string;
			content: string;
			attachments?: Array<{ featured: boolean; filename: string }>;
		}>;
		const imageNote = imageNotes.find((note) => note.title === imageTitle);
		expect(imageNote?.content).toBe('#image #photos #work');
		expect(imageNote?.attachments).toMatchObject([{ featured: true, filename: 'shortcut.png' }]);

		const multipleImagesTitle = `Shared images ${Date.now()}`;
		const multipleImagesCapture = await page.evaluate(async ({ token, title }) => {
			const formData = new FormData();
			formData.append('title', title);
			formData.append('input', 'Two photos from the Shortcut');
			formData.append('url', 'https://photos.example.com/album/1');
			formData.append('tags', 'Travel, #Later');
			formData.append('images', new File([new Uint8Array([1])], 'first.jpg', { type: 'image/jpeg' }));
			formData.append('images', new File([new Uint8Array([2])], 'second.jpg', { type: 'image/jpeg' }));
			const response = await fetch('/api/quick-capture', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				body: formData
			});
			return { status: response.status, body: await response.json() };
		}, { token: token!, title: multipleImagesTitle });
		expect(multipleImagesCapture).toMatchObject({
			status: 201,
			body: { message: 'Crumb captured', crumb: { title: multipleImagesTitle } }
		});
		const multipleImageNotes = (await (await page.request.get('/api/notes')).json()) as Array<{
			title: string;
			content: string;
			attachments?: Array<{ featured: boolean; filename: string }>;
		}>;
		const multipleImageNote = multipleImageNotes.find((note) => note.title === multipleImagesTitle);
		expect(multipleImageNote?.content).toContain('Two photos from the Shortcut');
		expect(multipleImageNote?.content).toContain(
			'<https://photos.example.com/album/1> · #text #link #image #example #travel #later'
		);
		expect(multipleImageNote?.attachments).toHaveLength(2);
		expect(multipleImageNote?.attachments?.filter((attachment) => attachment.featured)).toHaveLength(1);

		const invalidFileCapture = await page.request.post('/api/quick-capture', {
			headers: {
				Authorization: `Bearer ${token}`,
				Origin: new URL(page.url()).origin
			},
			multipart: {
				images: { name: 'not-an-image.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') }
			}
		});
		expect(invalidFileCapture.status()).toBe(400);

		const tooManyImages = await page.evaluate(async (token) => {
			const formData = new FormData();
			for (let index = 0; index < 11; index++) {
				formData.append('images', new File([new Uint8Array([index])], `${index}.jpg`, { type: 'image/jpeg' }));
			}
			return (await fetch('/api/quick-capture', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				body: formData
			})).status;
		}, token!);
		expect(tooManyImages).toBe(400);

		const voiceTitle = `Voice note ${Date.now()}`;
		const voiceCapture = await page.request.post('/api/quick-capture', {
			headers: { Authorization: `Bearer ${token}` },
			data: { title: voiceTitle, input: 'Remember to call Sam', mode: 'voice', tags: 'voice personal' }
		});
		expect(voiceCapture.status()).toBe(201);
		const voiceNotes = (await (await page.request.get('/api/notes')).json()) as Array<{ title: string; content: string }>;
		expect(voiceNotes.find((note) => note.title === voiceTitle)?.content).toBe('Remember to call Sam\n\n#voice #personal');

		await page.getByRole('button', { name: `Revoke ${tokenName}` }).click();
		await expect(page.getByRole('button', { name: `Revoke ${tokenName}` })).toHaveCount(0);
		const revoked = await page.request.post('/api/quick-capture', {
			headers: { Authorization: `Bearer ${token}` },
			data: { input: 'Should not save after revocation' }
		});
		expect(revoked.status()).toBe(401);
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
		const tag = `bulk-${testInfo.workerIndex}-${Date.now()}`;
		for (const suffix of ['one', 'two']) {
			expect((await page.request.post('/api/notes', { data: { title: `${prefix} ${suffix}`, content: `#${tag}` } })).ok()).toBeTruthy();
		}
		await page.goto(`/tag/${tag}`);
		await page.getByTestId('select-notes').click();
		await expect(noteCard(page, `${prefix} one`).getByRole('heading', { name: `${prefix} one` })).toHaveCSS('padding-left', '28px');
		await page.getByTestId('select-all-notes').click();
		await expect(page.getByText('2 selected')).toBeVisible();
		await page.getByRole('button', { name: 'Archive', exact: true }).click();
		await expect(noteCard(page, `${prefix} one`)).toHaveCount(0);
		await expect(noteCard(page, `${prefix} two`)).toHaveCount(0);
	});

	test('select all is limited to the first 200 visible crumbs and can be cleared', async ({ authenticatedPage: page }, testInfo) => {
		const tag = `bulk-limit-${testInfo.workerIndex}-${Date.now()}`;
		const creations = await Promise.all(Array.from({ length: 201 }, (_, index) =>
			page.request.post('/api/notes', { data: { title: `Limited ${index}`, content: `#${tag}` } })
		));
		expect(creations.every((response) => response.ok())).toBe(true);

		await page.goto(`/tag/${tag}`);
		await page.getByTestId('select-notes').click();
		await page.getByTestId('select-all-notes').click();
		await expect(page.getByText('200 selected')).toBeVisible();
		await expect(page.getByTestId('toast')).toContainText('first 200 visible crumbs');
		await page.getByTestId('select-all-notes').click();
		await expect(page.getByText('0 selected')).toBeVisible();
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

	test('portable import file picker enables import after choosing an archive', async ({ authenticatedPage: page }, testInfo) => {
		await page.goto('/settings/data');
		await page.getByTestId('portable-import-input').setInputFiles({
			name: 'crumbs-portable.zip',
			mimeType: 'application/zip',
			buffer: await portableArchive(`Picker ${testInfo.workerIndex}-${Date.now()}`)
		});
		await expect(page.getByTestId('portable-import-button')).toBeEnabled();
	});
});
