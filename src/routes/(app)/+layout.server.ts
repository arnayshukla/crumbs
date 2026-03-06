import { version } from '../../../package.json';

export function load() {
	return { appVersion: version };
}
