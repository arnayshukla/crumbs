<script lang="ts">
	import { writable } from 'svelte/store';

	interface ToastMessage {
		id: number;
		text: string;
		type: 'info' | 'success' | 'error';
		action?: { label: string; handler: () => void };
	}

	let counter = 0;
	export const toasts = writable<ToastMessage[]>([]);

	export function showToast(
		text: string,
		type: 'info' | 'success' | 'error' = 'info',
		action?: { label: string; handler: () => void },
		duration = 4000
	) {
		const id = ++counter;
		toasts.update((t) => [...t, { id, text, type, action }]);
		if (!action) {
			setTimeout(() => dismiss(id), duration);
		}
	}

	export function dismiss(id: number) {
		toasts.update((t) => t.filter((toast) => toast.id !== id));
	}
</script>

<div class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2">
	{#each $toasts as toast (toast.id)}
		<div
			class="flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg {toast.type === 'error' ? 'bg-red-600 text-white' : toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'}"
		>
			<span class="text-sm">{toast.text}</span>
			{#if toast.action}
				<button
					onclick={() => { toast.action?.handler(); dismiss(toast.id); }}
					class="text-sm font-semibold underline"
				>
					{toast.action.label}
				</button>
			{/if}
			<button onclick={() => dismiss(toast.id)} class="ml-2 opacity-70 hover:opacity-100">&times;</button>
		</div>
	{/each}
</div>
