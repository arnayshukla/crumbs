import { and, eq, lt } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { Db } from './db/index.js';
import { captureRequests, notes } from './db/schema.js';
import { createNote, deleteNote, updateNote } from './notes-service.js';
import { saveAttachment } from './attachments.js';
import { fetchLinkPreview } from './capture-enrichment.js';
import {
	buildCaptureDraft,
	findSharedUrl,
	type CaptureClient,
	type CaptureMode
} from '$lib/utils/capture.js';

export const MAX_CAPTURE_IMAGES = 10;
export const MAX_CAPTURE_IMAGE_SIZE = 10 * 1024 * 1024;
export const MAX_CAPTURE_TOTAL_IMAGE_SIZE = 50 * 1024 * 1024;
const IDEMPOTENCY_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

export interface CaptureInput {
	input: string;
	title?: string;
	url?: string;
	tags?: string;
	mode?: CaptureMode;
	client?: CaptureClient;
	clientVersion?: string;
	images: File[];
	idempotencyKey?: string;
}

export interface CaptureResult {
	message: 'Crumb captured';
	crumb: { id: string; title: string };
	replayed: boolean;
	enriched: boolean;
}

export class CaptureValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CaptureValidationError';
	}
}

function validateImages(images: readonly File[]): void {
	if (images.length > MAX_CAPTURE_IMAGES) {
		throw new CaptureValidationError(`A capture can contain at most ${MAX_CAPTURE_IMAGES} images`);
	}
	if (images.some((file) => !file.type.startsWith('image/'))) {
		throw new CaptureValidationError('Only image files are allowed');
	}
	if (images.some((file) => file.size > MAX_CAPTURE_IMAGE_SIZE)) {
		throw new CaptureValidationError('Each image must be 10MB or smaller');
	}
	if (images.reduce((total, file) => total + file.size, 0) > MAX_CAPTURE_TOTAL_IMAGE_SIZE) {
		throw new CaptureValidationError('Images must be 50MB or smaller in total');
	}
}

function hasMeaningfulBody(content: string): boolean {
	return content
		.split(/\r?\n/)
		.map((line) => line.trim())
		.some((line) => line && !/^<https?:\/\/[^>]+>(?:\s+·\s+.*)?$/i.test(line) && !/^(?:#[\w-]+\s*)+$/.test(line));
}

function fallbackHostname(sourceUrl: string): string {
	try {
		return new URL(sourceUrl).hostname.replace(/^www\./, '');
	} catch {
		return '';
	}
}

function findIdempotentCapture(database: Db, userId: number, key: string) {
	return database
		.select({ id: notes.id, title: notes.title })
		.from(captureRequests)
		.innerJoin(notes, eq(captureRequests.noteId, notes.id))
		.where(and(eq(captureRequests.userId, userId), eq(captureRequests.idempotencyKey, key)))
		.get();
}

export async function captureCrumb(database: Db, userId: number, input: CaptureInput): Promise<CaptureResult> {
	validateImages(input.images);
	if (!input.input && !input.url && input.images.length === 0) {
		throw new CaptureValidationError('Capture must contain text, a URL, or an image');
	}

	if (input.idempotencyKey) {
		const existing = findIdempotentCapture(database, userId, input.idempotencyKey);
		if (existing) {
			return {
				message: 'Crumb captured',
				crumb: existing,
				replayed: true,
				enriched: false
			};
		}
	}

	const sourceUrl = findSharedUrl(input.url?.trim() ?? '', input.input);
	const draft = buildCaptureDraft({
		title: input.title || (input.images.length > 0 ? `Shared image${input.images.length === 1 ? '' : 's'}` : undefined),
		text: input.input,
		url: input.url,
		tags: input.tags,
		mode: input.mode,
		imageCount: input.images.length
	});
	const createdCrumb = createNote(database, userId, draft);
	let crumb = {
		id: createdCrumb.id,
		title: createdCrumb.title,
		content: createdCrumb.content
	};

	if (input.idempotencyKey) {
		database.insert(captureRequests).values({
			id: uuidv4(),
			userId,
			noteId: crumb.id,
			idempotencyKey: input.idempotencyKey,
			createdAt: new Date()
		}).run();
		database.delete(captureRequests).where(lt(
			captureRequests.createdAt,
			new Date(Date.now() - IDEMPOTENCY_RETENTION_MS)
		)).run();
	}

	try {
		for (const [index, image] of input.images.entries()) {
			await saveAttachment(database, crumb.id, image, userId, null, index === 0);
		}
	} catch (cause) {
		await deleteNote(database, userId, crumb.id);
		throw new Error('Could not save the captured images', { cause });
	}

	let enriched = false;
	if (sourceUrl) {
		const preview = await fetchLinkPreview(sourceUrl);
		if (preview) {
			let previewImageSaved = false;
			if (preview.image && input.images.length === 0) {
				try {
					await saveAttachment(database, crumb.id, preview.image, userId, null, true);
					previewImageSaved = true;
					enriched = true;
				} catch {
					// Metadata remains useful when a remote preview image cannot be persisted.
				}
			}
			const titleIsFallback = crumb.title === fallbackHostname(sourceUrl);
			const contentHasBody = hasMeaningfulBody(crumb.content);
			const enrichedDraft = buildCaptureDraft({
				title: titleIsFallback && preview.metadata.title ? preview.metadata.title : crumb.title,
				text: contentHasBody
					? input.input
					: [input.input, preview.metadata.description].filter(Boolean).join('\n\n'),
				url: sourceUrl,
				tags: input.tags,
				mode: input.mode,
				imageCount: input.images.length + (previewImageSaved ? 1 : 0)
			});
			if (enrichedDraft.title !== crumb.title || enrichedDraft.content !== crumb.content) {
				const updated = updateNote(database, userId, crumb.id, enrichedDraft);
				if (updated) {
					crumb = { id: updated.id, title: updated.title, content: updated.content };
					enriched = true;
				}
			}
		}
	}

	return {
		message: 'Crumb captured',
		crumb: { id: crumb.id, title: crumb.title },
		replayed: false,
		enriched
	};
}
