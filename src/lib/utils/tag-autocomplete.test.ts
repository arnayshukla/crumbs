import { describe, expect, it } from 'vitest';
import { getTagQuery, insertTagAtQuery, rankTagSuggestions } from './tag-autocomplete.js';

describe('tag autocomplete', () => {
	it('finds a tag query at the cursor', () => {
		expect(getTagQuery('hello #wo', 9)).toEqual({ query: 'wo', start: 6, end: 9 });
	});

	it('requires a token boundary', () => {
		expect(getTagQuery('https://example/#wo', 19)).toBeNull();
	});

	it('ranks and inserts suggestions', () => {
		const query = getTagQuery('hello #wo', 9)!;
		expect(rankTagSuggestions(['personal', 'work', 'weekend'], query.query)).toEqual(['work']);
		expect(insertTagAtQuery('hello #wo', query, 'work')).toBe('hello #work ');
	});
});
