import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { captureCrumb, CaptureValidationError } from '$lib/server/capture-service.js';

const MAX_CAPTURE_TEXT_LENGTH = 50_000;
const MAX_CAPTURE_TITLE_LENGTH = 500;
const MAX_CAPTURE_URL_LENGTH = 4_096;

function formText(form: FormData, key: string, maxLength: number): string {
	const value = form.get(key);
	return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function resultRedirect(status: 'success' | 'error', message?: string): never {
	const params = new URLSearchParams({ capture: status });
	if (message) params.set('captureMessage', message);
	throw redirect(303, `/?${params.toString()}`);
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) resultRedirect('error', 'Sign in to Crumbs, then share again');

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		resultRedirect('error', 'Android could not send this item to Crumbs');
	}

	const images = form
		.getAll('images')
		.filter((value): value is File => typeof value !== 'string' && value.size > 0);

	try {
		await captureCrumb(db, locals.user.id, {
			title: formText(form, 'title', MAX_CAPTURE_TITLE_LENGTH),
			input: formText(form, 'text', MAX_CAPTURE_TEXT_LENGTH),
			url: formText(form, 'url', MAX_CAPTURE_URL_LENGTH),
			images,
			mode: 'auto',
			client: 'android-share',
			clientVersion: '1'
		});
	} catch (error) {
		if (error instanceof CaptureValidationError) resultRedirect('error', error.message);
		resultRedirect('error', 'Capture failed. Check your connection and share again');
	}

	resultRedirect('success');
};
