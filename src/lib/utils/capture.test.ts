import { describe, expect, it } from 'vitest';
import { buildBookmarklet, buildCaptureDraft, decodeCaptureFragment, sourceTagFromUrl } from './capture.js';

describe('capture utilities', () => {
	it('parses shared text into a clean draft with source metadata', () => {
		expect(buildCaptureDraft({ title: 'Page', text: 'Page\nQuote\nhttps://example.com', url: 'https://example.com' })).toEqual({
			title: 'Page',
			content: 'Quote\n\n[Source](https://example.com) · #example'
		});
	});

	it('extracts a URL from share text and infers a missing title', () => {
		expect(buildCaptureDraft({ text: 'An article title\nhttps://news.ycombinator.com/item?id=1' })).toEqual({
			title: 'An article title',
			content: '[Source](https://news.ycombinator.com/item?id=1) · #ycombinator'
		});
	});

	it('derives readable source tags without treating co.uk as the source', () => {
		expect(sourceTagFromUrl('https://github.com/bretzel-app/crumbs')).toBe('github');
		expect(sourceTagFromUrl('https://www.bbc.co.uk/news')).toBe('bbc');
		expect(sourceTagFromUrl('not a url')).toBeNull();
	});

	it('decodes bookmarklet fragments safely', () => {
		const payload = encodeURIComponent(JSON.stringify({ title: 'Page', text: 'Quote', url: 'https://example.com' }));
		expect(decodeCaptureFragment(`#${payload}`)?.title).toBe('Page');
		expect(decodeCaptureFragment('#not-json')).toBeNull();
	});

	it('decodes URL-encoded Shortcut input without sending it to the server', () => {
		const shared = encodeURIComponent('Interesting reel\nhttps://www.instagram.com/reel/example/');
		expect(decodeCaptureFragment(`#share=${shared}`)).toEqual({
			title: 'Interesting reel',
			content: '[Source](https://www.instagram.com/reel/example/) · #instagram'
		});
		expect(decodeCaptureFragment('#share=')).toBeNull();
		expect(decodeCaptureFragment('#share=%E0%A4%A')).toBeNull();
	});

	it('targets the configured origin in the current tab', () => {
		const bookmarklet = buildBookmarklet('https://crumbs.example/');
		expect(bookmarklet).toContain('https://crumbs.example/capture?from=bookmarklet#');
		expect(bookmarklet).toContain('location.assign');
		expect(bookmarklet).not.toContain('window.open');
	});
});
