import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { validateQuickCaptureToken } from '$lib/server/quick-capture-tokens.js';
import { checkIpRateLimit } from '$lib/server/ip-rate-limit.js';
import { captureCrumb, CaptureValidationError } from '$lib/server/capture-service.js';
import { fetchCaptureImage } from '$lib/server/capture-enrichment.js';
import { parseCaptureRequest } from '$lib/server/quick-capture-request.js';
import type { CaptureRequest } from '$lib/server/quick-capture-request.js';

const responseHeaders = {
	'Cache-Control': 'no-store',
	Vary: 'Accept',
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'Accept, Authorization, Content-Type, Idempotency-Key',
	'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function captureResponse(request: Request, payload: Record<string, unknown>, status: number): Response {
	const wantsText = request.headers
		.get('accept')
		?.split(',')
		.some((value) => value.trim().split(';', 1)[0] === 'text/plain');
	if (wantsText) {
		const message =
			typeof payload.message === 'string'
				? payload.message
				: typeof payload.error === 'string'
					? payload.error
					: status < 400
						? 'Crumb captured'
						: 'Capture failed';
		const body = typeof payload.warning === 'string' ? `${message} · ${payload.warning}` : message;
		return new Response(body, {
			status,
			headers: { ...responseHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
		});
	}
	return json(payload, { status, headers: responseHeaders });
}

export const OPTIONS: RequestHandler = async () => new Response(null, { status: 204, headers: responseHeaders });

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!checkIpRateLimit(`quick-capture:${getClientAddress()}`)) {
		return captureResponse(request, { error: 'Too many requests' }, 429);
	}

	const authorization = request.headers.get('authorization');
	const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
	const userId = validateQuickCaptureToken(token, db);
	if (!userId) {
		return captureResponse(request, { error: 'Unauthorized' }, 401);
	}

	let capture: CaptureRequest | null;
	try {
		capture = await parseCaptureRequest(request);
	} catch {
		return captureResponse(request, { error: 'Request body must be valid JSON or multipart form data' }, 400);
	}
	if (!capture) {
		return captureResponse(request, { error: 'Invalid capture fields' }, 400);
	}
	try {
		if (capture.images.length + capture.imageUrls.length > 10) {
			throw new CaptureValidationError('A capture can contain at most 10 images');
		}
		const remoteImages: File[] = [];
		for (const [index, imageUrl] of capture.imageUrls.entries()) {
			const image = await fetchCaptureImage(imageUrl, capture.images.length + index);
			if (image) remoteImages.push(image);
		}
		const skippedImages = capture.imageUrls.length - remoteImages.length;
		const result = await captureCrumb(db, userId, {
			...capture,
			images: [...capture.images, ...remoteImages],
			idempotencyKey: request.headers.get('idempotency-key')?.trim().slice(0, 256) || undefined
		});
		const warning =
			skippedImages > 0
				? `${skippedImages} selected image${skippedImages === 1 ? '' : 's'} could not be added`
				: undefined;
		return captureResponse(request, { ...result, warning }, result.replayed ? 200 : 201);
	} catch (error) {
		if (error instanceof CaptureValidationError) {
			return captureResponse(request, { error: error.message }, 400);
		}
		return captureResponse(request, { error: 'Could not capture crumb' }, 500);
	}
};
