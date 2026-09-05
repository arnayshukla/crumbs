import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchPublicResource } = vi.hoisted(() => ({ fetchPublicResource: vi.fn() }));

vi.mock('./public-resource.js', () => ({ fetchPublicResource }));

import { fetchCaptureImage } from './capture-enrichment.js';

describe('capture image download', () => {
	beforeEach(() => fetchPublicResource.mockReset());

	it('turns a bounded public image response into an uploadable file', async () => {
		fetchPublicResource.mockResolvedValue({
			url: new URL('https://images.example/photo.webp'),
			status: 200,
			contentType: 'image/webp',
			body: Buffer.from([1, 2, 3])
		});

		const file = await fetchCaptureImage('https://images.example/photo.webp', 1);
		expect(file).toMatchObject({ name: 'captured-image-2.webp', type: 'image/webp', size: 3 });
		expect(fetchPublicResource).toHaveBeenCalledWith(
			'https://images.example/photo.webp',
			expect.objectContaining({ maxBytes: 10 * 1024 * 1024, accept: 'image/*' })
		);
	});

	it('ignores non-image responses', async () => {
		fetchPublicResource.mockResolvedValue({
			url: new URL('https://images.example/not-image'),
			status: 200,
			contentType: 'text/html',
			body: Buffer.from('no')
		});
		expect(await fetchCaptureImage('https://images.example/not-image', 0)).toBeNull();
	});
});
