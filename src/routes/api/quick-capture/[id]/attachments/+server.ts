import { and, eq, gte, like } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { attachments, captureRequests } from '$lib/server/db/schema.js';
import { saveAttachment } from '$lib/server/attachments.js';
import {
	CaptureValidationError,
	MAX_CAPTURE_IMAGES,
	MAX_CAPTURE_TOTAL_IMAGE_SIZE
} from '$lib/server/capture-service.js';
import { readRawCaptureImage } from '$lib/server/raw-capture-attachment.js';
import { checkIpRateLimit } from '$lib/server/ip-rate-limit.js';
import { validateQuickCaptureToken } from '$lib/server/quick-capture-tokens.js';

const UPLOAD_WINDOW_MS = 15 * 60 * 1_000;
const responseHeaders = {
	'Cache-Control': 'no-store',
	Vary: 'Accept',
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'Accept, Authorization, Content-Type, X-Crumbs-Filename',
	'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function response(request: Request, message: string, status: number): Response {
	const wantsText = request.headers.get('accept')?.includes('text/plain');
	return wantsText
		? new Response(message, {
				status,
				headers: { ...responseHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
			})
		: Response.json(status < 400 ? { message } : { error: message }, { status, headers: responseHeaders });
}

export const OPTIONS: RequestHandler = async () => new Response(null, { status: 204, headers: responseHeaders });

export const POST: RequestHandler = async ({ params, request, getClientAddress }) => {
	if (!checkIpRateLimit(`quick-capture-attachment:${getClientAddress()}`)) {
		return response(request, 'Too many requests', 429);
	}

	const authorization = request.headers.get('authorization');
	const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
	const userId = validateQuickCaptureToken(token, db);
	if (!userId) return response(request, 'Unauthorized', 401);

	const uploadSession = db
		.select({ noteId: captureRequests.noteId })
		.from(captureRequests)
		.where(
			and(
				eq(captureRequests.noteId, params.id),
				eq(captureRequests.userId, userId),
				like(captureRequests.idempotencyKey, 'upload:%'),
				gte(captureRequests.createdAt, new Date(Date.now() - UPLOAD_WINDOW_MS))
			)
		)
		.get();
	if (!uploadSession) return response(request, 'Capture upload session not found or expired', 404);

	const existing = db
		.select({ size: attachments.size, featured: attachments.featured })
		.from(attachments)
		.where(eq(attachments.noteId, params.id))
		.all();
	if (existing.length >= MAX_CAPTURE_IMAGES) {
		return response(request, `A capture can contain at most ${MAX_CAPTURE_IMAGES} images`, 400);
	}

	try {
		const image = await readRawCaptureImage(request, existing.length + 1);
		const existingSize = existing.reduce((total, attachment) => total + attachment.size, 0);
		if (existingSize + image.size > MAX_CAPTURE_TOTAL_IMAGE_SIZE) {
			throw new CaptureValidationError('Images must be 50MB or smaller in total');
		}
		await saveAttachment(
			db,
			params.id,
			image,
			userId,
			null,
			!existing.some((attachment) => attachment.featured)
		);
		return response(request, 'Image added', 201);
	} catch (error) {
		if (error instanceof CaptureValidationError) return response(request, error.message, 400);
		console.error('[quick-capture attachment] failed', { noteId: params.id, error });
		return response(request, 'Could not add image', 500);
	}
};
