import { describe, expect, it } from 'vitest';
import { buildBookmarklet, buildCaptureDraft, decodeCaptureFragment, normalizeCaptureTags, sourceTagFromUrl } from './capture.js';

describe('capture utilities', () => {
	it('parses shared text into a clean draft with source metadata', () => {
		expect(buildCaptureDraft({ title: 'Page', text: 'Page\nQuote\nhttps://example.com', url: 'https://example.com' })).toEqual({
			title: 'Page',
			content: 'Quote\n\n<https://example.com> · #example'
		});
	});

	it('extracts a URL from share text and infers a missing title', () => {
		expect(buildCaptureDraft({ text: 'An article title\nhttps://news.ycombinator.com/item?id=1' })).toEqual({
			title: 'An article title',
			content: '<https://news.ycombinator.com/item?id=1> · #ycombinator'
		});
	});

	it('derives readable source tags without treating co.uk as the source', () => {
		expect(sourceTagFromUrl('https://github.com/bretzel-app/crumbs')).toBe('github');
		expect(sourceTagFromUrl('https://www.bbc.co.uk/news')).toBe('bbc');
		expect(sourceTagFromUrl('not a url')).toBeNull();
	});

	it('normalizes, deduplicates, and merges requested tags with the source tag', () => {
		expect(normalizeCaptureTags('Work, ideas #LATER invalid! work')).toEqual(['work', 'ideas', 'later']);
		expect(normalizeCaptureTags(`${'a'.repeat(49)} valid ${Array.from({ length: 25 }, (_, index) => `tag${index}`).join(' ')}`))
			.toEqual(['valid', ...Array.from({ length: 19 }, (_, index) => `tag${index}`)]);
		expect(buildCaptureDraft({
			title: 'Reel',
			url: 'https://www.instagram.com/reel/example/',
			tags: 'Work, #instagram later'
		}).content).toBe('<https://www.instagram.com/reel/example/> · #instagram #work #later');
	});

	it('keeps voice transcription in the body and appends voice tags', () => {
		expect(buildCaptureDraft({ title: 'Voice note', text: 'Remember to call Sam', tags: 'voice work' })).toEqual({
			title: 'Voice note',
			content: 'Remember to call Sam\n\n#voice #work'
		});
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
			content: '<https://www.instagram.com/reel/example/> · #instagram'
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
