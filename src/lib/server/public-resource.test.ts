import { describe, expect, it } from 'vitest';
import { isPrivateOrReservedIp } from './public-resource.js';

describe('public resource URL safety', () => {
	it.each([
		'127.0.0.1',
		'10.0.0.1',
		'169.254.169.254',
		'192.168.1.1',
		'198.51.100.2',
		'100.64.0.1',
		'::1',
		'fe80::1',
		'fc00::1',
		'::ffff:127.0.0.1',
		'2001:db8::1'
	])('blocks %s', (address) => {
		expect(isPrivateOrReservedIp(address)).toBe(true);
	});

	it.each(['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111'])('allows %s', (address) => {
		expect(isPrivateOrReservedIp(address)).toBe(false);
	});

	it('does not over-block neighbouring public IPv4 ranges', () => {
		expect(isPrivateOrReservedIp('198.51.99.2')).toBe(false);
	});
});
