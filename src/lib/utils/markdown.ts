import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
	html: false,
	linkify: true,
	typographer: true,
	breaks: true
});

// Add task list support
md.core.ruler.after('inline', 'task-lists', (state) => {
	const tokens = state.tokens;
	for (let i = 0; i < tokens.length; i++) {
		if (tokens[i].type !== 'inline') continue;
		const content = tokens[i].content;
		if (content.startsWith('[ ] ') || content.startsWith('[x] ')) {
			const checked = content.startsWith('[x] ');
			const checkbox = checked
				? '<input type="checkbox" checked disabled class="task-checkbox" /> '
				: '<input type="checkbox" disabled class="task-checkbox" /> ';
			tokens[i].content = content.slice(4);
			tokens[i].children = md.parseInline(tokens[i].content, state.env)[0].children;
			// Prepend checkbox
			const token = new state.Token('html_inline', '', 0);
			token.content = checkbox;
			tokens[i].children!.unshift(token);

			// Add task-list class to parent <ul> (once)
			for (let j = i - 1; j >= 0; j--) {
				if (tokens[j].type === 'bullet_list_open') {
					const cls = tokens[j].attrGet('class') ?? '';
					if (!cls.includes('task-list')) {
						tokens[j].attrJoin('class', 'task-list');
					}
					break;
				}
			}
		}
	}
});

export function renderMarkdown(content: string): string {
	return md.render(content);
}

export function stripMarkdown(content: string): string {
	// Simple strip for preview - remove markdown syntax
	return content
		.replace(/```[\s\S]*?```/g, '')
		.replace(/`[^`]*`/g, '')
		.replace(/!\[.*?\]\(.*?\)/g, '')
		.replace(/\[([^\]]*)\]\(.*?\)/g, '$1')
		.replace(/[#*_~\[\]]/g, '')
		.trim();
}
