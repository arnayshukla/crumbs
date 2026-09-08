import { describe, expect, it } from 'vitest';
import { isForbiddenCrossOriginForm } from './csrf.js';

const appUrl = new URL('https://crumbs.example/api/data/import');

function request(
	method: string,
	contentType: string,
	origin?: string,
	url = appUrl
): Request {
	const headers = new Headers({ 'Content-Type': contentType });
	if (origin) headers.set('Origin', origin);
	return new Request(url, { method, headers });
}

describe('cross-origin form protection', () => {
	it('allows native multipart Quick Capture requests without an Origin header', () => {
		const url = new URL('https://crumbs.example/api/quick-capture');
		expect(
			isForbiddenCrossOriginForm(
				request('POST', 'multipart/form-data; boundary=test', undefined, url),
				url
			)
		).toBe(false);
	});

	it('keeps same-origin form submissions working', () => {
		expect(isForbiddenCrossOriginForm(request('POST', 'multipart/form-data; boundary=test', appUrl.origin), appUrl)).toBe(false);
	});

	it.each([undefined, 'https://attacker.example'])('rejects other form submissions from %s', (origin) => {
		expect(
			isForbiddenCrossOriginForm(
				request('POST', 'multipart/form-data; boundary=test', origin),
				appUrl
			)
		).toBe(true);
	});

	it('does not apply form-origin checks to JSON requests', () => {
		expect(isForbiddenCrossOriginForm(request('POST', 'application/json'), appUrl)).toBe(false);
	});

	it('does not apply form-origin checks to safe methods', () => {
		expect(isForbiddenCrossOriginForm(request('GET', 'text/plain'), appUrl)).toBe(false);
	});
});
