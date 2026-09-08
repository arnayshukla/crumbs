import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';

const INSTALLERS: Record<string, { assetPath: string; filename: string }> = {
	'capture-to-crumbs': {
		assetPath: '/shortcuts/capture-to-crumbs.shortcut',
		filename: 'Capture to Crumbs.shortcut'
	},
	'voice-to-crumbs': {
		assetPath: '/shortcuts/voice-to-crumbs.shortcut',
		filename: 'Voice to Crumbs.shortcut'
	}
};

export const GET: RequestHandler = async ({ params, fetch }) => {
	const installer = INSTALLERS[params.kind];
	if (!installer) throw error(404, 'Shortcut installer not found');

	const asset = await fetch(installer.assetPath);
	if (!asset.ok) throw error(500, 'Shortcut installer is unavailable');
	const body = await asset.arrayBuffer();

	return new Response(body, {
		headers: {
			'Cache-Control': 'no-store',
			'Content-Disposition': `attachment; filename="${installer.filename}"`,
			'Content-Length': String(body.byteLength),
			'Content-Type': 'application/octet-stream',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
