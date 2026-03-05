<script lang="ts">
	interface ChecklistItem {
		text: string;
		checked: boolean;
	}

	interface Props {
		content: string;
		onChange: (content: string) => void;
	}

	let { content, onChange }: Props = $props();

	let items = $state<ChecklistItem[]>(parseChecklist(content));

	function parseChecklist(text: string): ChecklistItem[] {
		if (!text.trim()) return [{ text: '', checked: false }];
		const lines = text.split('\n');
		return lines.map((line) => {
			if (line.startsWith('- [x] ')) return { text: line.slice(6), checked: true };
			if (line.startsWith('- [ ] ')) return { text: line.slice(6), checked: false };
			return { text: line, checked: false };
		});
	}

	function serializeChecklist(list: ChecklistItem[]): string {
		return list
			.map((item) => `- [${item.checked ? 'x' : ' '}] ${item.text}`)
			.join('\n');
	}

	function emitChange() {
		onChange(serializeChecklist(items));
	}

	function toggleItem(index: number) {
		items[index].checked = !items[index].checked;
		emitChange();
	}

	function updateText(index: number, text: string) {
		items[index].text = text;
		emitChange();
	}

	function addItem(afterIndex: number) {
		items.splice(afterIndex + 1, 0, { text: '', checked: false });
		items = [...items];
		emitChange();
		// Focus new input on next tick
		setTimeout(() => {
			const inputs = document.querySelectorAll<HTMLInputElement>('[data-testid="checklist-input"]');
			inputs[afterIndex + 1]?.focus();
		}, 0);
	}

	function removeItem(index: number) {
		if (items.length <= 1) return;
		items.splice(index, 1);
		items = [...items];
		emitChange();
	}

	function handleKeydown(e: KeyboardEvent, index: number) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addItem(index);
		} else if (e.key === 'Backspace' && items[index].text === '' && items.length > 1) {
			e.preventDefault();
			removeItem(index);
			setTimeout(() => {
				const inputs = document.querySelectorAll<HTMLInputElement>('[data-testid="checklist-input"]');
				inputs[Math.max(0, index - 1)]?.focus();
			}, 0);
		}
	}
</script>

<div class="space-y-1" data-testid="checklist">
	{#each items as item, index}
		<div class="flex items-center gap-2">
			<input
				type="checkbox"
				checked={item.checked}
				onchange={() => toggleItem(index)}
				class="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
				data-testid="checklist-checkbox"
			/>
			<input
				type="text"
				value={item.text}
				oninput={(e) => updateText(index, (e.target as HTMLInputElement).value)}
				onkeydown={(e) => handleKeydown(e, index)}
				class="flex-1 bg-transparent text-sm outline-none {item.checked ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-200'}"
				placeholder="List item"
				data-testid="checklist-input"
			/>
			<button
				onclick={() => removeItem(index)}
				class="opacity-0 hover:opacity-100 focus:opacity-100"
				aria-label="Remove item"
				data-testid="checklist-remove"
			>
				<svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	{/each}
	<button
		onclick={() => addItem(items.length - 1)}
		class="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
		data-testid="checklist-add"
	>
		<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
		</svg>
		Add item
	</button>
</div>
