import { describe, expect, it } from 'vitest';
import { extractLinkMetadata } from './capture-enrichment.js';

describe('capture link metadata', () => {
	it('prefers Open Graph metadata and resolves relative URLs', () => {
		const html = `
			<html><head>
				<title>Fallback &amp; title</title>
				<meta content="A useful description" property="og:description">
				<meta property="og:title" content="Product &amp; details">
				<meta name="twitter:image" content="/preview.jpg">
				<link href="/canonical" rel="canonical alternate">
			</head></html>`;
		expect(extractLinkMetadata(html, new URL('https://shop.example/item?tracking=1'))).toEqual({
			title: 'Product & details',
			description: 'A useful description',
			canonicalUrl: 'https://shop.example/canonical',
			previewImageUrl: 'https://shop.example/preview.jpg'
		});
	});

	it('rejects non-http metadata URLs and strips markup', () => {
		const metadata = extractLinkMetadata(
			'<title>Hello <b>world</b></title><meta property="og:image" content="javascript:alert(1)">',
			new URL('https://example.com')
		);
		expect(metadata.title).toBe('Hello world');
		expect(metadata.previewImageUrl).toBe('');
	});
});
