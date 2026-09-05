import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

const DEFAULT_MAX_REDIRECTS = 5;

export interface PublicResource {
	url: URL;
	status: number;
	contentType: string;
	body: Buffer;
}

export interface PublicResourceOptions {
	maxBytes: number;
	timeoutMs: number;
	maxRedirects?: number;
	accept?: string;
}

export function isPrivateOrReservedIp(address: string): boolean {
	if (address.includes(':')) {
		const normalized = address.toLowerCase();
		if (normalized === '::' || normalized === '::1') return true;
		if (normalized.startsWith('fe8') || normalized.startsWith('fe9')
			|| normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
		if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
		if (normalized.startsWith('ff')) return true;
		if (normalized.startsWith('2001:db8:') || normalized.startsWith('2001:10:')
			|| normalized.startsWith('2001:2:') || normalized.startsWith('2002:')) return true;
		if (normalized.startsWith('::ffff:')) return isPrivateOrReservedIp(normalized.split(':').pop()!);
		const compatible = normalized.match(/^::(\d{1,3}(?:\.\d{1,3}){3})$/);
		return compatible ? isPrivateOrReservedIp(compatible[1]) : false;
	}

	const parts = address.split('.').map(Number);
	if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
	const [a, b, c] = parts;
	if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
	if (a === 100 && b >= 64 && b <= 127) return true;
	if (a === 169 && b === 254) return true;
	if (a === 172 && b >= 16 && b <= 31) return true;
	if (a === 192 && b === 168) return true;
	if (a === 192 && b === 0) return true;
	if (a === 198 && (b === 18 || b === 19)) return true;
	if (a === 198 && b === 51 && c === 100) return true;
	if (a === 203 && b === 0 && c === 113) return true;
	return false;
}

async function resolvePublicAddress(hostname: string): Promise<{ address: string; family: number }> {
	const records = await lookup(hostname, { all: true });
	if (records.length === 0) throw new Error('DNS lookup returned no addresses');
	if (records.some((record) => isPrivateOrReservedIp(record.address))) {
		throw new Error('URL resolves to a private or reserved address');
	}
	return records[0];
}

function requestPinned(
	url: URL,
	address: string,
	family: number,
	options: PublicResourceOptions
): Promise<Omit<PublicResource, 'url'> & { location: string | null }> {
	return new Promise((resolve, reject) => {
		const requestFn = url.protocol === 'https:' ? httpsRequest : httpRequest;
		const req = requestFn({
			hostname: url.hostname,
			servername: url.hostname,
			port: url.port || (url.protocol === 'https:' ? 443 : 80),
			path: `${url.pathname}${url.search}`,
			method: 'GET',
			headers: {
				Accept: options.accept ?? '*/*',
				'Accept-Encoding': 'identity',
				'User-Agent': 'CrumbsCapture/1.0 (+https://github.com/bretzel-app/crumbs)'
			},
			lookup: (_hostname, _lookupOptions, callback) => callback(null, address, family)
		}, (response) => {
			const chunks: Buffer[] = [];
			let total = 0;
			response.on('data', (chunk: Buffer) => {
				total += chunk.length;
				if (total > options.maxBytes) {
					req.destroy(new Error(`Response exceeds ${options.maxBytes} bytes`));
					return;
				}
				chunks.push(chunk);
			});
			response.on('end', () => {
				const header = response.headers['content-type'];
				const contentType = (Array.isArray(header) ? header[0] : header ?? '')
					.split(';', 1)[0]
					.trim()
					.toLowerCase();
				const location = response.headers.location;
				resolve({
					status: response.statusCode ?? 0,
					contentType,
					body: Buffer.concat(chunks),
					location: Array.isArray(location) ? location[0] ?? null : location ?? null
				});
			});
			response.on('error', reject);
		});
		req.setTimeout(options.timeoutMs, () => req.destroy(new Error('Request timed out')));
		req.on('error', reject);
		req.end();
	});
}

export async function fetchPublicResource(
	value: string,
	options: PublicResourceOptions
): Promise<PublicResource> {
	let url = new URL(value);
	const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
	const deadline = Date.now() + options.timeoutMs;

	for (let hop = 0; hop <= maxRedirects; hop += 1) {
		if (url.protocol !== 'http:' && url.protocol !== 'https:') {
			throw new Error('Only http/https URLs are allowed');
		}
		const timeoutMs = deadline - Date.now();
		if (timeoutMs <= 0) throw new Error('Request timed out');
		const { address, family } = await resolvePublicAddress(url.hostname);
		const response = await requestPinned(url, address, family, { ...options, timeoutMs });
		if (response.status >= 300 && response.status < 400 && response.location) {
			url = new URL(response.location, url);
			continue;
		}
		return { url, status: response.status, contentType: response.contentType, body: response.body };
	}

	throw new Error('Too many redirects');
}
