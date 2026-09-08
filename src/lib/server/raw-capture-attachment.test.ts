import { describe, expect, it } from 'vitest';
import { readRawCaptureImage } from './raw-capture-attachment.js';
import { CaptureValidationError } from './capture-service.js';

describe('readRawCaptureImage', () => {
	it('preserves a declared image body as a File', async () => {
		const request = new Request('https://crumbs.example/upload', {
			method: 'POST',
			headers: { 'Content-Type': 'image/jpeg', 'X-Crumbs-Filename': 'photo.jpg' },
			body: new Uint8Array([0xff, 0xd8, 0xff, 0x00])
		});

		const file = await readRawCaptureImage(request, 1);
		expect(file).toMatchObject({ name: 'photo.jpg', type: 'image/jpeg', size: 4 });
	});

	it('detects an image when Shortcuts sends a generic file content type', async () => {
		const request = new Request('https://crumbs.example/upload', {
			method: 'POST',
			headers: { 'Content-Type': 'application/octet-stream' },
			body: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
		});

		const file = await readRawCaptureImage(request, 2);
		expect(file).toMatchObject({ name: 'shared-image-2.png', type: 'image/png', size: 8 });
	});

	it('rejects a generic body that is not a recognized image', async () => {
		const request = new Request('https://crumbs.example/upload', {
			method: 'POST',
			headers: { 'Content-Type': 'application/octet-stream' },
			body: 'not an image'
		});

		await expect(readRawCaptureImage(request, 1)).rejects.toBeInstanceOf(CaptureValidationError);
	});
});
