import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(root, 'static/shortcuts/manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

function sha256(path) {
	return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const failures = [];
const generatorHash = sha256(resolve(root, 'scripts/build-apple-shortcuts.py'));
if (generatorHash !== manifest.generatorSha256) {
	failures.push('scripts/build-apple-shortcuts.py changed without regenerating the signed Shortcut artifacts');
}

for (const [filename, metadata] of Object.entries(manifest.artifacts)) {
	const artifactHash = sha256(resolve(root, 'static/shortcuts', filename));
	if (artifactHash !== metadata.sha256) {
		failures.push(`${filename} does not match static/shortcuts/manifest.json`);
	}
}

if (failures.length > 0) {
	throw new Error(`Shortcut artifact verification failed:\n- ${failures.join('\n- ')}`);
}

console.log('Verified signed Apple Shortcut artifacts');
