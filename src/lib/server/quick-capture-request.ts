import { z } from 'zod';
import { CAPTURE_CLIENTS, CAPTURE_MODES } from '$lib/utils/capture.js';

export const captureInputSchema = z
	.object({
		input: z.string().trim().max(50_000).optional().default(''),
		title: z.string().trim().max(500).optional(),
		url: z.string().trim().max(4_096).optional(),
		tags: z.string().trim().max(1_000).optional(),
		mode: z.enum(CAPTURE_MODES).optional(),
		client: z.enum(CAPTURE_CLIENTS).optional(),
		clientVersion: z.string().trim().max(32).optional(),
		imageCount: z.coerce.number().int().min(0).max(10).optional().default(0),
		imageUrls: z.array(z.string().trim().url().max(4_096)).max(10).optional().default([])
	})
	.strict();

export type CaptureFields = z.infer<typeof captureInputSchema>;

export interface CaptureRequest extends CaptureFields {
	images: File[];
}

function formText(formData: FormData, key: string): string | undefined {
	const value = formData.get(key);
	return typeof value === 'string' ? value : undefined;
}

function parseFormData(formData: FormData): CaptureRequest | null {
	const parsed = captureInputSchema.safeParse({
		input: formText(formData, 'input') ?? '',
		title: formText(formData, 'title'),
		url: formText(formData, 'url'),
		tags: formText(formData, 'tags'),
		mode: formText(formData, 'mode'),
		client: formText(formData, 'client'),
		clientVersion: formText(formData, 'clientVersion'),
		imageCount: formText(formData, 'imageCount') ?? 0,
		imageUrls: formData.getAll('imageUrls').filter((value): value is string => typeof value === 'string')
	});
	if (!parsed.success) return null;
	return {
		...parsed.data,
		images: formData.getAll('images').filter((value): value is File => typeof value !== 'string')
	};
}

/** Parse the JSON, URL-encoded Form, or multipart Form emitted by capture clients. */
export async function parseCaptureRequest(request: Request): Promise<CaptureRequest | null> {
	const contentType = request.headers.get('content-type') ?? '';
	if (contentType.includes('multipart/form-data')) {
		return parseFormData(await request.formData());
	}
	if (contentType.includes('application/x-www-form-urlencoded')) {
		const formData = new FormData();
		for (const [key, value] of new URLSearchParams(await request.text())) {
			formData.append(key, value);
		}
		return parseFormData(formData);
	}

	const parsed = captureInputSchema.safeParse(await request.json());
	return parsed.success ? { ...parsed.data, images: [] } : null;
}
