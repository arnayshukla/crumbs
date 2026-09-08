import {
	MAX_CAPTURE_IMAGE_SIZE,
	CaptureValidationError
} from './capture-service.js';

const MIME_EXTENSIONS: Readonly<Record<string, string>> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/gif': 'gif',
	'image/webp': 'webp',
	'image/heic': 'heic',
	'image/heif': 'heif',
	'image/avif': 'avif'
};

function sniffImageMime(bytes: Uint8Array): string | null {
	if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
		return 'image/jpeg';
	}
	if (
		bytes.length >= 8 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47 &&
		bytes[4] === 0x0d &&
		bytes[5] === 0x0a &&
		bytes[6] === 0x1a &&
		bytes[7] === 0x0a
	) {
		return 'image/png';
	}
	if (bytes.length >= 6) {
		const signature = String.fromCharCode(...bytes.slice(0, 6));
		if (signature === 'GIF87a' || signature === 'GIF89a') return 'image/gif';
	}
	if (bytes.length >= 12) {
		const container = String.fromCharCode(...bytes.slice(0, 4));
		const brand = String.fromCharCode(...bytes.slice(8, 12));
		if (container === 'RIFF' && brand === 'WEBP') return 'image/webp';
		if (String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp') {
			if (['heic', 'heix', 'hevc', 'hevx'].includes(brand)) return 'image/heic';
			if (['heif', 'mif1', 'msf1'].includes(brand)) return 'image/heif';
			if (brand === 'avif') return 'image/avif';
		}
	}
	return null;
}

function safeFilename(request: Request, mimeType: string, index: number): string {
	const subtypeExtension = mimeType.slice(6).replace(/[^a-z0-9]/gi, '');
	const fallbackExtension = MIME_EXTENSIONS[mimeType] ?? (subtypeExtension || 'img');
	const requested = request.headers.get('x-crumbs-filename');
	if (!requested) return `shared-image-${index}.${fallbackExtension}`;
	let decoded = requested;
	try {
		decoded = decodeURIComponent(requested);
	} catch {
		// Use the original header when it was not percent-encoded.
	}
	const cleaned = decoded.replace(/[\u0000-\u001f/\\]/g, '_').trim().slice(0, 240);
	return cleaned || `shared-image-${index}.${fallbackExtension}`;
}

export async function readRawCaptureImage(request: Request, index: number): Promise<File> {
	const declaredLength = Number(request.headers.get('content-length'));
	if (Number.isFinite(declaredLength) && declaredLength > MAX_CAPTURE_IMAGE_SIZE) {
		throw new CaptureValidationError('Each image must be 10MB or smaller');
	}

	const bytes = new Uint8Array(await request.arrayBuffer());
	if (bytes.length === 0) throw new CaptureValidationError('The image file is empty');
	if (bytes.length > MAX_CAPTURE_IMAGE_SIZE) {
		throw new CaptureValidationError('Each image must be 10MB or smaller');
	}

	const declaredMime = (request.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase();
	const mimeType = declaredMime.startsWith('image/') ? declaredMime : sniffImageMime(bytes);
	if (!mimeType) throw new CaptureValidationError('Only image files are allowed');

	return new File([bytes], safeFilename(request, mimeType, index), { type: mimeType });
}
