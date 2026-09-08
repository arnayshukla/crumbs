import { describe, expect, it } from 'vitest';
import { parseCaptureRequest } from './quick-capture-request.js';

describe('parseCaptureRequest', () => {
	it('parses the URL-encoded Form emitted for text and links', async () => {
		const request = new Request('https://crumbs.example/api/quick-capture', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({ input: 'Amazon link\nhttps://amazon.in/item', tags: 'shopping later' })
		});

		expect(await parseCaptureRequest(request)).toMatchObject({
			input: 'Amazon link\nhttps://amazon.in/item',
			tags: 'shopping later',
			images: []
		});
	});

	it('preserves repeated image files in multipart Form data', async () => {
		const formData = new FormData();
		formData.append('input', 'Two photos');
		formData.append('images', new File(['first'], 'first.jpg', { type: 'image/jpeg' }));
		formData.append('images', new File(['second'], 'second.jpg', { type: 'image/jpeg' }));

		const request = new Request('https://crumbs.example/api/quick-capture', {
			method: 'POST',
			body: formData
		});

		const parsed = await parseCaptureRequest(request);
		expect(parsed?.images.map((image) => image.name)).toEqual(['first.jpg', 'second.jpg']);
	});

	it('preserves the JSON contract', async () => {
		const request = new Request('https://crumbs.example/api/quick-capture', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ input: 'Voice note', mode: 'voice' })
		});

		expect(await parseCaptureRequest(request)).toMatchObject({ input: 'Voice note', mode: 'voice', images: [] });
	});

	it('accepts the client identifier used by the Apple share Shortcut', async () => {
		const request = new Request('https://crumbs.example/api/quick-capture', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({ input: 'Saved from iPhone', client: 'apple-shortcut' })
		});

		expect(await parseCaptureRequest(request)).toMatchObject({
			input: 'Saved from iPhone',
			client: 'apple-shortcut',
			images: []
		});
	});

	it('parses the image count used by the two-step Apple Shortcut upload', async () => {
		const request = new Request('https://crumbs.example/api/quick-capture', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				input: '1e7f18dd-cd0d-46e5-a00d-79372485604f',
				imageCount: '2',
				client: 'apple-shortcut',
				clientVersion: '4'
			})
		});

		expect(await parseCaptureRequest(request)).toMatchObject({
			imageCount: 2,
			client: 'apple-shortcut',
			clientVersion: '4'
		});
	});
});
