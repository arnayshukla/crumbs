import { describe, expect, it } from 'vitest';
import { APPLE_SHORTCUTS, shortcutSetupValues } from './apple-shortcuts.js';

describe('Apple Shortcut installers', () => {
	it('ships separate public installers for sharing and voice capture', () => {
		expect(APPLE_SHORTCUTS.share.installUrl).toBe('/shortcuts/capture-to-crumbs.shortcut');
		expect(APPLE_SHORTCUTS.voice.installUrl).toBe('/shortcuts/voice-to-crumbs.shortcut');
		expect(APPLE_SHORTCUTS.share.tokenName).not.toBe(APPLE_SHORTCUTS.voice.tokenName);
	});

	it('builds portable setup values for the current self-hosted instance', () => {
		expect(shortcutSetupValues('https://crumbs.example/', 'capture-token')).toEqual({
			endpoint: 'https://crumbs.example/api/quick-capture',
			token: 'capture-token'
		});
	});
});
