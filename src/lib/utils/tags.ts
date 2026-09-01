/**
 * Extract #hashtags from text content.
 * Matches hashtags that start with # followed by word characters.
 * Does not match inside code blocks or URLs.
 */
export function extractTags(content: string): string[] {
	if (!content) return [];

	// Remove code blocks (``` ... ```) to avoid matching inside them
	const withoutCodeBlocks = content.replace(/```[\s\S]*?```/g, '');
	// Remove inline code (` ... `)
	const withoutInlineCode = withoutCodeBlocks.replace(/`[^`]*`/g, '');
	// Remove URLs
	const withoutUrls = withoutInlineCode.replace(/https?:\/\/\S+/g, '');

	const matches = withoutUrls.match(/(?:^|\s)#([\w-]+)/g);
	if (!matches) return [];

	const tags = matches.map((m) => m.trim().slice(1).toLowerCase());
	return [...new Set(tags)];
}

export interface TagToken {
	name: string;
	start: number;
	end: number;
}

/** Locate parser-recognised hashtag tokens while preserving source offsets. */
export function findTagTokens(content: string): TagToken[] {
	if (!content) return [];

	const ignored = new Array<boolean>(content.length).fill(false);
	const markIgnored = (pattern: RegExp) => {
		for (const match of content.matchAll(pattern)) {
			const start = match.index ?? 0;
			for (let index = start; index < start + match[0].length; index += 1) ignored[index] = true;
		}
	};

	markIgnored(/```[\s\S]*?```/g);
	markIgnored(/`[^`]*`/g);
	markIgnored(/https?:\/\/\S+/g);

	const tokens: TagToken[] = [];
	for (const match of content.matchAll(/(?:^|\s)#([\w-]+)/g)) {
		const wholeStart = match.index ?? 0;
		const hashOffset = match[0].lastIndexOf('#');
		const start = wholeStart + hashOffset;
		if (ignored[start]) continue;
		tokens.push({ name: match[1].toLowerCase(), start, end: start + match[1].length + 1 });
	}
	return tokens;
}

export function rewriteTag(content: string, source: string, target?: string): string {
	const normalizedSource = source.toLowerCase();
	const matching = findTagTokens(content).filter((token) => token.name === normalizedSource);
	if (matching.length === 0) return content;

	let rewritten = content;
	for (const token of matching.toReversed()) {
		rewritten = `${rewritten.slice(0, token.start)}${target ? `#${target}` : ''}${rewritten.slice(token.end)}`;
	}
	return target ? rewritten : rewritten.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+\n/g, '\n');
}
