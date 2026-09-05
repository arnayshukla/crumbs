import type { CaptureDraft } from '$lib/types/index.js';

export interface SharedCapture {
	title?: string;
	text?: string;
	url?: string;
	tags?: string;
	mode?: CaptureMode;
	imageCount?: number;
}

export const CAPTURE_MODES = ['auto', 'voice'] as const;
export type CaptureMode = (typeof CAPTURE_MODES)[number];

export const CAPTURE_CLIENTS = [
	'ios-share',
	'apple-watch',
	'bookmarklet',
	'android-share'
] as const;
export type CaptureClient = (typeof CAPTURE_CLIENTS)[number];

const URL_PATTERN = /https?:\/\/[^\s<>]+/gi;
const COMPOUND_DOMAIN_LABELS = new Set(['ac', 'co', 'com', 'edu', 'gov', 'net', 'org']);
const MAX_CAPTURE_TAGS = 20;

export function normalizeCaptureTags(value: string): string[] {
	const normalized = value
		.split(/[\s,]+/)
		.map((tag) => tag.trim().replace(/^#+/, '').toLowerCase())
		.filter((tag) => /^[\w-]{1,48}$/.test(tag));
	return [...new Set(normalized)].slice(0, MAX_CAPTURE_TAGS);
}

function cleanUrlCandidate(value: string): string {
	return value.replace(/[),.;!?]+$/, '');
}

export function findSharedUrl(explicitUrl: string, text: string): string {
	const candidates = [explicitUrl, ...(text.match(URL_PATTERN) ?? [])];
	return candidates.map(cleanUrlCandidate).find((candidate) => {
		try {
			const parsed = new URL(candidate);
			return parsed.protocol === 'http:' || parsed.protocol === 'https:';
		} catch {
			return false;
		}
	}) ?? '';
}

export function sourceTagFromUrl(url: string): string | null {
	if (!url) return null;
	try {
		const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
		if (hostname === 'amzn.to' || hostname === 'amazon.com' || hostname === 'amazon.in'
			|| hostname.endsWith('.amazon.com') || hostname.endsWith('.amazon.in')) {
			return 'amazon';
		}
		const labels = hostname.split('.').filter(Boolean);
		if (labels.length === 0) return null;
		const finalLabel = labels.at(-1) ?? '';
		const penultimate = labels.at(-2) ?? '';
		const useThirdFromEnd = finalLabel.length === 2 && COMPOUND_DOMAIN_LABELS.has(penultimate);
		const source = labels.at(useThirdFromEnd ? -3 : -2) ?? labels[0];
		const normalized = source.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
		return normalized || null;
	} catch {
		return null;
	}
}

export function captureTypeTags(shared: SharedCapture, sourceUrl: string, bodyText: string): string[] {
	const tags: string[] = [];
	if (shared.mode === 'voice') {
		tags.push('voice');
	} else if (bodyText) {
		tags.push('text');
	}
	if (sourceUrl) tags.push('link');
	if ((shared.imageCount ?? 0) > 0) tags.push('image');
	if (sourceUrl) {
		try {
			const parsed = new URL(sourceUrl);
			if (sourceTagFromUrl(sourceUrl) === 'instagram' && /^\/reels?\//i.test(parsed.pathname)) {
				tags.push('reel');
			}
		} catch {
			// findSharedUrl already validates URLs; keep this helper safe for direct callers.
		}
	}
	return tags;
}

function removeShareSheetDuplicates(text: string, title: string, url: string): string {
	const normalizedUrl = cleanUrlCandidate(url);
	const lines = text.split(/\r?\n/).map((line) => line.trim());
	return lines
		.filter((line, index) => {
			if (!line) return false;
			if (index === 0 && title && line.toLocaleLowerCase() === title.toLocaleLowerCase()) return false;
			return !normalizedUrl || cleanUrlCandidate(line) !== normalizedUrl;
		})
		.join('\n')
		.trim();
}

export function buildCaptureDraft(shared: SharedCapture): CaptureDraft {
	const suppliedTitle = shared.title?.trim().slice(0, 500) ?? '';
	const sharedText = shared.text?.trim() ?? '';
	const sourceUrl = findSharedUrl(shared.url?.trim() ?? '', sharedText);
	let title = suppliedTitle;
	let text = removeShareSheetDuplicates(sharedText, title, sourceUrl);

	if (!title && text) {
		const [firstLine, ...remainingLines] = text.split('\n');
		if (firstLine.length <= 160 && !firstLine.match(URL_PATTERN)) {
			title = firstLine;
			text = remainingLines.join('\n').trim();
		}
	}

	if (!title && sourceUrl) {
		title = new URL(sourceUrl).hostname.replace(/^www\./, '');
	}

	const sourceTag = sourceTagFromUrl(sourceUrl);
	const tags = normalizeCaptureTags([
		...captureTypeTags(shared, sourceUrl, text),
		sourceTag,
		shared.tags
	].filter(Boolean).join(' '));
	const tagText = tags.map((tag) => `#${tag}`).join(' ');
	const sourceLine = sourceUrl
		? `<${sourceUrl}>${tagText ? ` · ${tagText}` : ''}`
		: '';
	return { title, content: [text, sourceLine, sourceUrl ? '' : tagText].filter(Boolean).join('\n\n') };
}

export function decodeCaptureFragment(fragment: string): CaptureDraft | null {
	if (!fragment) return null;
	const encoded = fragment.replace(/^#/, '');
	if (encoded.startsWith('share=')) {
		try {
			const shared = decodeURIComponent(encoded.slice('share='.length)).trim();
			return shared ? buildCaptureDraft({ text: shared }) : null;
		} catch {
			return null;
		}
	}
	try {
		const raw = JSON.parse(decodeURIComponent(encoded)) as unknown;
		if (!raw || typeof raw !== 'object') return null;
		const value = raw as Record<string, unknown>;
		return buildCaptureDraft({
			title: typeof value.title === 'string' ? value.title : '',
			text: typeof value.text === 'string' ? value.text : '',
			url: typeof value.url === 'string' ? value.url : '',
			tags: typeof value.tags === 'string' ? value.tags : ''
		});
	} catch {
		return null;
	}
}

export function buildBookmarklet(origin: string): string {
	const target = `${origin.replace(/\/$/, '')}/capture?from=bookmarklet`;
	return `javascript:(()=>{const d={title:document.title,text:String(window.getSelection()),url:location.href};location.assign('${target}#'+encodeURIComponent(JSON.stringify(d)))})()`;
}
