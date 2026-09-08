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
});
