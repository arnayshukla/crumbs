import { fail } from '@sveltejs/kit';
import type { Actions } from './$types.js';
import { buildCaptureDraft } from '$lib/utils/capture.js';

const MAX_CAPTURE_LENGTH = 50_000;

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const title = String(form.get('title') ?? '').slice(0, 500);
		const text = String(form.get('text') ?? '').slice(0, MAX_CAPTURE_LENGTH);
		const url = String(form.get('url') ?? '').slice(0, 4_096);
		const draft = buildCaptureDraft({ title, text, url });
		if (!draft.title && !draft.content) return fail(400, { message: 'Nothing was shared' });
		return { draft };
	}
};
