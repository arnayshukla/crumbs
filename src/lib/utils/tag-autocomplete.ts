export interface TagQuery {
	query: string;
	start: number;
	end: number;
}

export function getTagQuery(text: string, cursor: number): TagQuery | null {
	const beforeCursor = text.slice(0, cursor);
	const match = beforeCursor.match(/(?:^|\s)#([\w-]*)$/);
	if (!match) return null;
	const query = match[1].toLowerCase();
	return { query, start: cursor - query.length - 1, end: cursor };
}

export function rankTagSuggestions(tags: string[], query: string, limit = 8): string[] {
	const normalized = query.toLowerCase();
	return [...new Set(tags.map((tag) => tag.toLowerCase()))]
		.filter((tag) => tag.startsWith(normalized))
		.sort((left, right) => {
			const exactDiff = Number(right === normalized) - Number(left === normalized);
			return exactDiff || left.localeCompare(right);
		})
		.slice(0, limit);
}

export function insertTagAtQuery(text: string, query: TagQuery, tag: string): string {
	return `${text.slice(0, query.start)}#${tag} ${text.slice(query.end)}`;
}
