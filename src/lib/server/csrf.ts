const FORM_CONTENT_TYPES = new Set([
	'application/x-www-form-urlencoded',
	'multipart/form-data',
	'text/plain'
]);

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const CROSS_ORIGIN_FORM_EXEMPT_PATHS = new Set(['/api/quick-capture']);

function contentType(request: Request): string {
	return (request.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase();
}

/**
 * Mirrors SvelteKit's default form-origin protection while allowing narrowly
 * scoped endpoints whose own bearer credential is not ambient browser state.
 */
export function isForbiddenCrossOriginForm(request: Request, url: URL): boolean {
	if (CROSS_ORIGIN_FORM_EXEMPT_PATHS.has(url.pathname)) return false;
	if (!MUTATING_METHODS.has(request.method.toUpperCase())) return false;
	if (!FORM_CONTENT_TYPES.has(contentType(request))) return false;
	return request.headers.get('origin') !== url.origin;
}
