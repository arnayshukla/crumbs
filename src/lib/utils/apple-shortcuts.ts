export const APPLE_SHORTCUTS = {
	share: {
		name: 'Capture to Crumbs',
		installUrl: '/shortcuts/install/capture-to-crumbs',
		filename: 'Capture to Crumbs.shortcut',
		tokenName: 'Capture to Crumbs (iPhone)'
	},
	voice: {
		name: 'Voice to Crumbs',
		installUrl: '/shortcuts/install/voice-to-crumbs',
		filename: 'Voice to Crumbs.shortcut',
		tokenName: 'Voice to Crumbs (Apple Watch)'
	}
} as const;

export type AppleShortcutKind = keyof typeof APPLE_SHORTCUTS;

export function shortcutSetupValues(origin: string, token: string) {
	return {
		endpoint: `${origin.replace(/\/$/, '')}/api/quick-capture`,
		token
	};
}
