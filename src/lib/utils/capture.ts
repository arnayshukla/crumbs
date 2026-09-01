import type { CaptureDraft } from '$lib/types/index.js';

export interface SharedCapture {
	title?: string;
	text?: string;
	url?: string;
}

export function buildCaptureDraft(shared: SharedCapture): CaptureDraft {
	const title = shared.title?.trim() ?? '';
	const text = shared.text?.trim() ?? '';
	const url = shared.url?.trim() ?? '';
	const parts = [text];
	if (url && !text.includes(url)) parts.push(url);
	return { title, content: parts.filter(Boolean).join('\n\n') };
}

export function decodeCaptureFragment(fragment: string): CaptureDraft | null {
	if (!fragment) return null;
	try {
		const raw = JSON.parse(decodeURIComponent(fragment.replace(/^#/, ''))) as unknown;
		if (!raw || typeof raw !== 'object') return null;
		const value = raw as Record<string, unknown>;
		return buildCaptureDraft({
			title: typeof value.title === 'string' ? value.title : '',
			text: typeof value.text === 'string' ? value.text : '',
			url: typeof value.url === 'string' ? value.url : ''
		});
	} catch {
		return null;
	}
}

export function buildBookmarklet(origin: string): string {
	const target = `${origin.replace(/\/$/, '')}/capture`;
	return `javascript:(()=>{const d={title:document.title,text:String(window.getSelection()),url:location.href};window.open('${target}#'+encodeURIComponent(JSON.stringify(d)),'_blank','noopener')})()`;
}
