import { describe, expect, it } from 'vitest';
import { buildBookmarklet, buildCaptureDraft, decodeCaptureFragment } from './capture.js';

describe('capture utilities', () => {
	it('combines shared text and URL without duplicating the URL', () => {
		expect(buildCaptureDraft({ title: 'Page', text: 'Quote', url: 'https://example.com' })).toEqual({ title: 'Page', content: 'Quote\n\nhttps://example.com' });
		expect(buildCaptureDraft({ text: 'See https://example.com', url: 'https://example.com' }).content).toBe('See https://example.com');
	});

	it('decodes bookmarklet fragments safely', () => {
		const payload = encodeURIComponent(JSON.stringify({ title: 'Page', text: 'Quote', url: 'https://example.com' }));
		expect(decodeCaptureFragment(`#${payload}`)?.title).toBe('Page');
		expect(decodeCaptureFragment('#not-json')).toBeNull();
	});

	it('targets the configured origin', () => {
		expect(buildBookmarklet('https://crumbs.example/')).toContain('https://crumbs.example/capture#');
	});
});
