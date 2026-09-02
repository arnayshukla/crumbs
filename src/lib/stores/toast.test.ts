import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { dismiss, showToast, toasts } from './toast.js';

beforeEach(() => {
	vi.useFakeTimers();
	toasts.set([]);
});

afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
});

describe('toast lifecycle', () => {
	it('dismisses a non-action toast after its duration', () => {
		showToast('Saved', 'success', undefined, 4_000);
		expect(get(toasts)).toHaveLength(1);

		vi.advanceTimersByTime(4_000);

		expect(get(toasts)).toEqual([]);
	});

	it('keeps an actionable toast until it is dismissed', () => {
		showToast('Offline', 'info', { label: 'Retry', handler: () => {} }, 4_000);
		const [toast] = get(toasts);
		vi.advanceTimersByTime(8_000);
		expect(get(toasts)).toHaveLength(1);

		dismiss(toast.id);
		expect(get(toasts)).toEqual([]);
	});
});
