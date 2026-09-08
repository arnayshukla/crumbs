import sanitizeHtml from 'sanitize-html';
import { decodeHTML } from 'entities';
import { fetchPublicResource } from './public-resource.js';

const MAX_HTML_BYTES = 1024 * 1024;
const MAX_PREVIEW_BYTES = 10 * 1024 * 1024;
const ENRICHMENT_TIMEOUT_MS = 3_000;
const CAPTURE_IMAGE_TIMEOUT_MS = 5_000;

export interface LinkMetadata {
	title: string;
	description: string;
	canonicalUrl: string;
	previewImageUrl: string;
}

export interface LinkPreview {
	metadata: LinkMetadata;
	image: File | null;
}

function decodeText(value: string): string {
	return decodeHTML(sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }))
		.replace(/\s+/g, ' ')
		.trim();
}

function parseAttributes(tag: string): ReadonlyMap<string, string> {
	const attributes = new Map<string, string>();
	const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
	for (const match of tag.matchAll(pattern)) {
		attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '');
	}
	return attributes;
}

function absoluteHttpUrl(value: string, base: URL): string {
	if (!value) return '';
	try {
		const url = new URL(decodeText(value), base);
		return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
	} catch {
		return '';
	}
}

export function extractLinkMetadata(html: string, finalUrl: URL): LinkMetadata {
	const values = new Map<string, string>();
	for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
		const attributes = parseAttributes(tag);
		const key = (attributes.get('property') ?? attributes.get('name') ?? '').toLowerCase();
		const content = attributes.get('content') ?? '';
		if (key && content && !values.has(key)) values.set(key, content);
	}

	let canonicalUrl = '';
	for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
		const attributes = parseAttributes(tag);
		const rel = (attributes.get('rel') ?? '').toLowerCase().split(/\s+/);
		if (rel.includes('canonical')) {
			canonicalUrl = absoluteHttpUrl(attributes.get('href') ?? '', finalUrl);
			if (canonicalUrl) break;
		}
	}

	const documentTitle = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
	return {
		title: decodeText(values.get('og:title') ?? values.get('twitter:title') ?? documentTitle).slice(0, 500),
		description: decodeText(
			values.get('og:description') ?? values.get('twitter:description') ?? values.get('description') ?? ''
		).slice(0, 2_000),
		canonicalUrl: canonicalUrl || finalUrl.href,
		previewImageUrl: absoluteHttpUrl(
			values.get('og:image:secure_url') ?? values.get('og:image') ?? values.get('twitter:image') ?? '',
			finalUrl
		)
	};
}

function imageExtension(contentType: string): string {
	const extensions: Record<string, string> = {
		'image/avif': 'avif',
		'image/gif': 'gif',
		'image/jpeg': 'jpg',
		'image/png': 'png',
		'image/webp': 'webp'
	};
	return extensions[contentType] ?? 'img';
}

export async function fetchCaptureImage(imageUrl: string, index: number): Promise<File | null> {
	try {
		const image = await fetchPublicResource(imageUrl, {
			maxBytes: MAX_PREVIEW_BYTES,
			timeoutMs: CAPTURE_IMAGE_TIMEOUT_MS,
			accept: 'image/*'
		});
		if (image.status < 200 || image.status >= 300 || !image.contentType.startsWith('image/')) {
			return null;
		}
		return new File(
			[new Uint8Array(image.body)],
			`captured-image-${index + 1}.${imageExtension(image.contentType)}`,
			{ type: image.contentType }
		);
	} catch {
		return null;
	}
}

export async function fetchLinkPreview(sourceUrl: string): Promise<LinkPreview | null> {
	const deadline = Date.now() + ENRICHMENT_TIMEOUT_MS;
	try {
		const page = await fetchPublicResource(sourceUrl, {
			maxBytes: MAX_HTML_BYTES,
			timeoutMs: ENRICHMENT_TIMEOUT_MS,
			accept: 'text/html,application/xhtml+xml'
		});
		if (page.status < 200 || page.status >= 300) return null;
		if (page.contentType !== 'text/html' && page.contentType !== 'application/xhtml+xml') return null;

		const metadata = extractLinkMetadata(page.body.toString('utf8'), page.url);
		const remainingMs = deadline - Date.now();
		if (!metadata.previewImageUrl || remainingMs <= 100) return { metadata, image: null };

		try {
			const preview = await fetchPublicResource(metadata.previewImageUrl, {
				maxBytes: MAX_PREVIEW_BYTES,
				timeoutMs: remainingMs,
				accept: 'image/*'
			});
			if (preview.status < 200 || preview.status >= 300 || !preview.contentType.startsWith('image/')) {
				return { metadata, image: null };
			}
			const file = new File(
				[new Uint8Array(preview.body)],
				`link-preview.${imageExtension(preview.contentType)}`,
				{ type: preview.contentType }
			);
			return { metadata, image: file };
		} catch {
			return { metadata, image: null };
		}
	} catch {
		return null;
	}
}
