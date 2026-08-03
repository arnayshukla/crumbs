import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { NoteFilter } from '$lib/types/index.js';
import {
	listNotes,
	getNote,
	createNote,
	updateNote,
	deleteNote,
	searchNotes,
	listAllTags,
	reorderNotes
} from '../notes-service.js';
import { saveAttachment } from '../attachments.js';
import { db } from '../db/index.js';

const NOTE_COLORS = [
	'default',
	'coral',
	'peach',
	'sand',
	'mint',
	'sage',
	'fog',
	'storm',
	'dusk',
	'blossom',
	'clay',
	'chalk'
] as const;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB, matches the manual attachment upload limit
const MAX_IMAGE_REDIRECTS = 5;

// Blocks loopback, unspecified, link-local (incl. cloud metadata 169.254.169.254),
// RFC1918/ULA private ranges, 6to4/IPv4-mapped tunnels, and multicast/broadcast so
// upload_image can't be used to reach internal network services.
function isPrivateOrReservedIp(address: string): boolean {
	if (address.includes(':')) {
		const normalized = address.toLowerCase();
		if (normalized === '::' || normalized === '::1') return true;
		if (normalized.startsWith('fe80:')) return true;
		if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
		if (normalized.startsWith('2002:')) return true; // 6to4 tunnel, can embed a private IPv4
		if (normalized.startsWith('::ffff:')) return isPrivateOrReservedIp(normalized.split(':').pop()!);
		// Legacy IPv4-compatible form, e.g. "::1.2.3.4" (distinct from "::ffff:1.2.3.4")
		const ipv4Compatible = normalized.match(/^::(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
		if (ipv4Compatible) return isPrivateOrReservedIp(ipv4Compatible[1]);
		return false;
	}
	const parts = address.split('.').map(Number);
	if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
	const [a, b] = parts;
	if (a === 10 || a === 127 || a === 0) return true;
	if (a === 169 && b === 254) return true;
	if (a === 172 && b >= 16 && b <= 31) return true;
	if (a === 192 && b === 168) return true;
	if (a === 100 && b >= 64 && b <= 127) return true;
	if (a >= 224) return true; // multicast (224.0.0.0/4) and broadcast/reserved (240.0.0.0/4, 255.255.255.255)
	return false;
}

// Resolves every A/AAAA record for a hostname and rejects if ANY is private/reserved
// (not just the first), so a validated hostname can't have a private record hiding
// behind a public one in the same DNS answer.
async function resolveValidatedAddress(hostname: string): Promise<{ address: string; family: number }> {
	const records = await lookup(hostname, { all: true });
	if (records.length === 0) throw new Error('DNS lookup returned no addresses');
	for (const record of records) {
		if (isPrivateOrReservedIp(record.address)) {
			throw new Error('URL resolves to a private or reserved address');
		}
	}
	return records[0];
}

interface PinnedResponse {
	ok: boolean;
	status: number;
	statusText: string;
	headers: { get(name: string): string | null };
	arrayBuffer(): Promise<ArrayBuffer>;
}

// Issues the request against the exact address validated by resolveValidatedAddress,
// bypassing a second DNS resolution at connect time — otherwise a rebinding attacker
// could serve a public address to the validator and a private one to the real connect.
function requestPinnedAddress(url: URL, address: string, family: number): Promise<PinnedResponse> {
	return new Promise((resolve, reject) => {
		const requestFn = url.protocol === 'https:' ? httpsRequest : httpRequest;
		const req = requestFn(
			{
				hostname: url.hostname,
				servername: url.hostname,
				port: url.port || (url.protocol === 'https:' ? 443 : 80),
				path: url.pathname + url.search,
				method: 'GET',
				timeout: 15000,
				lookup: (_hostname: string, _options: unknown, callback: (err: null, address: string, family: number) => void) => {
					callback(null, address, family);
				}
			},
			(res) => {
				const chunks: Buffer[] = [];
				let total = 0;
				res.on('data', (chunk: Buffer) => {
					total += chunk.length;
					if (total > MAX_IMAGE_BYTES) {
						req.destroy(new Error('Image too large (max 10MB)'));
						return;
					}
					chunks.push(chunk);
				});
				res.on('end', () => {
					const buffer = Buffer.concat(chunks);
					const status = res.statusCode ?? 0;
					resolve({
						ok: status >= 200 && status < 300,
						status,
						statusText: res.statusMessage ?? '',
						headers: {
							get: (name: string) => {
								const value = res.headers[name.toLowerCase()];
								return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
							}
						},
						arrayBuffer: async () =>
							buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
					});
				});
				res.on('error', reject);
			}
		);
		req.on('error', reject);
		req.end();
	});
}

// Fetches an attacker-supplied URL for the MCP upload_image tool, re-validating the
// target on every redirect hop so a public URL can't SSRF via a 3xx to an internal address.
async function fetchPublicImage(imageUrl: string): Promise<PinnedResponse> {
	let currentUrl = new URL(imageUrl);
	for (let hop = 0; hop <= MAX_IMAGE_REDIRECTS; hop++) {
		if (currentUrl.protocol !== 'http:' && currentUrl.protocol !== 'https:') {
			throw new Error('Only http/https URLs are allowed');
		}
		const { address, family } = await resolveValidatedAddress(currentUrl.hostname);
		const response = await requestPinnedAddress(currentUrl, address, family);
		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get('location');
			if (!location) return response;
			currentUrl = new URL(location, currentUrl);
			continue;
		}
		return response;
	}
	throw new Error('Too many redirects');
}

export function createMcpServer(userId: number): McpServer {
	const server = new McpServer({
		name: 'crumbs',
		version: '0.7.2'
	});

	server.tool(
		'list_notes',
		'List notes with optional filter (all, archived, trashed) and tag filter',
		{
			filter: z
				.enum(['all', 'archived', 'trashed'])
				.optional()
				.describe('Filter notes by status'),
			tag: z.string().optional().describe('Filter by tag name')
		},
		async ({ filter = 'all', tag }: { filter?: string; tag?: string }) => {
			let result = listNotes(db, userId, filter as NoteFilter);

			if (tag) {
				result = result.filter((n) =>
					(n.tags ?? []).some((t: string) => t.toLowerCase() === tag.toLowerCase())
				);
			}

			return {
				content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
			};
		}
	);

	server.tool(
		'get_note',
		'Get a single note by ID with its tags and attachments',
		{ id: z.string().describe('Note ID') },
		async ({ id }: { id: string }) => {
			const note = getNote(db, userId, id);
			if (!note) {
				return {
					content: [{ type: 'text' as const, text: 'Note not found' }],
					isError: true
				};
			}

			return {
				content: [{ type: 'text' as const, text: JSON.stringify(note, null, 2) }]
			};
		}
	);

	server.tool(
		'create_note',
		'Create a new note',
		{
			title: z.string().optional().describe('Note title'),
			content: z.string().optional().describe('Note content (supports markdown)'),
			color: z.enum(NOTE_COLORS).optional().describe('Note color'),
			checklistMode: z.boolean().optional().describe('Enable checklist mode')
		},
		async ({ title, content, color, checklistMode }: { title?: string; content?: string; color?: string; checklistMode?: boolean }) => {
			const note = createNote(db, userId, { title, content, color, checklistMode });
			return {
				content: [{ type: 'text' as const, text: JSON.stringify(note, null, 2) }]
			};
		}
	);

	server.tool(
		'update_note',
		'Update an existing note',
		{
			id: z.string().describe('Note ID'),
			title: z.string().optional().describe('New title'),
			content: z.string().optional().describe('New content'),
			color: z.enum(NOTE_COLORS).optional().describe('New color'),
			pinned: z.boolean().optional().describe('Pin/unpin'),
			checklistMode: z.boolean().optional().describe('Enable/disable checklist mode')
		},
		async ({ id, ...updates }: { id: string; title?: string; content?: string; color?: string; pinned?: boolean; checklistMode?: boolean }) => {
			const result = updateNote(db, userId, id, updates);
			if (!result) {
				return {
					content: [{ type: 'text' as const, text: 'Note not found' }],
					isError: true
				};
			}

			return {
				content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
			};
		}
	);

	server.tool(
		'trash_note',
		'Move a note to trash',
		{ id: z.string().describe('Note ID') },
		async ({ id }: { id: string }) => {
			const result = updateNote(db, userId, id, { trashed: true });
			if (!result) {
				return {
					content: [{ type: 'text' as const, text: 'Note not found' }],
					isError: true
				};
			}
			return {
				content: [{ type: 'text' as const, text: `Note "${result.title}" trashed` }]
			};
		}
	);

	server.tool(
		'restore_note',
		'Restore a note from trash',
		{ id: z.string().describe('Note ID') },
		async ({ id }: { id: string }) => {
			const result = updateNote(db, userId, id, { trashed: false });
			if (!result) {
				return {
					content: [{ type: 'text' as const, text: 'Note not found' }],
					isError: true
				};
			}
			return {
				content: [{ type: 'text' as const, text: `Note "${result.title}" restored` }]
			};
		}
	);

	server.tool(
		'archive_note',
		'Archive a note',
		{ id: z.string().describe('Note ID') },
		async ({ id }: { id: string }) => {
			const result = updateNote(db, userId, id, { archived: true });
			if (!result) {
				return {
					content: [{ type: 'text' as const, text: 'Note not found' }],
					isError: true
				};
			}
			return {
				content: [{ type: 'text' as const, text: `Note "${result.title}" archived` }]
			};
		}
	);

	server.tool(
		'unarchive_note',
		'Unarchive a note',
		{ id: z.string().describe('Note ID') },
		async ({ id }: { id: string }) => {
			const result = updateNote(db, userId, id, { archived: false });
			if (!result) {
				return {
					content: [{ type: 'text' as const, text: 'Note not found' }],
					isError: true
				};
			}
			return {
				content: [{ type: 'text' as const, text: `Note "${result.title}" unarchived` }]
			};
		}
	);

	server.tool(
		'delete_note',
		'Permanently delete a note',
		{ id: z.string().describe('Note ID') },
		async ({ id }: { id: string }) => {
			const existing = getNote(db, userId, id);
			if (!existing) {
				return {
					content: [{ type: 'text' as const, text: 'Note not found' }],
					isError: true
				};
			}

			deleteNote(db, userId, id);
			return {
				content: [
					{
						type: 'text' as const,
						text: `Note "${existing.title}" permanently deleted`
					}
				]
			};
		}
	);

	server.tool(
		'search_notes',
		'Search notes by title, content, or tag name',
		{ query: z.string().describe('Search query') },
		async ({ query }: { query: string }) => {
			const results = searchNotes(db, userId, query);
			return {
				content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }]
			};
		}
	);

	server.tool('list_tags', 'List all tags', {}, async () => {
		const allTags = listAllTags(db, userId);
		return {
			content: [{ type: 'text' as const, text: JSON.stringify(allTags, null, 2) }]
		};
	});

	server.tool(
		'pin_note',
		'Pin or unpin a note',
		{
			id: z.string().describe('Note ID'),
			pinned: z.boolean().describe('Whether to pin (true) or unpin (false)')
		},
		async ({ id, pinned }: { id: string; pinned: boolean }) => {
			const result = updateNote(db, userId, id, { pinned });
			if (!result) {
				return {
					content: [{ type: 'text' as const, text: 'Note not found' }],
					isError: true
				};
			}
			return {
				content: [
					{
						type: 'text' as const,
						text: `Note "${result.title}" ${pinned ? 'pinned' : 'unpinned'}`
					}
				]
			};
		}
	);

	server.tool(
		'reorder_notes',
		'Reorder notes by setting sort orders',
		{
			orders: z
				.array(
					z.object({
						id: z.string().describe('Note ID'),
						sortOrder: z.number().describe('New sort order')
					})
				)
				.describe('Array of note IDs with their new sort orders')
		},
		async ({ orders }: { orders: { id: string; sortOrder: number }[] }) => {
			reorderNotes(db, userId, orders);
			return {
				content: [{ type: 'text' as const, text: `Reordered ${orders.length} notes` }]
			};
		}
	);

	server.tool(
		'upload_image',
		'Attach an image to a note by fetching it from a URL',
		{
			noteId: z.string().describe('Note ID to attach the image to'),
			imageUrl: z.string().url().describe('URL of the image to fetch')
		},
		async ({ noteId, imageUrl }: { noteId: string; imageUrl: string }) => {
			const existing = getNote(db, userId, noteId);
			if (!existing) {
				return {
					content: [{ type: 'text' as const, text: 'Note not found' }],
					isError: true
				};
			}

			try {
				const response = await fetchPublicImage(imageUrl);
				if (!response.ok) {
					return {
						content: [
							{
								type: 'text' as const,
								text: `Failed to fetch image: ${response.status} ${response.statusText}`
							}
						],
						isError: true
					};
				}

				const contentType = response.headers.get('content-type') || '';
				if (!contentType.startsWith('image/')) {
					return {
						content: [{ type: 'text' as const, text: 'URL did not return an image' }],
						isError: true
					};
				}

				const contentLength = Number(response.headers.get('content-length'));
				if (contentLength > MAX_IMAGE_BYTES) {
					return {
						content: [{ type: 'text' as const, text: 'Image too large (max 10MB)' }],
						isError: true
					};
				}

				const buffer = Buffer.from(await response.arrayBuffer());
				if (buffer.byteLength > MAX_IMAGE_BYTES) {
					return {
						content: [{ type: 'text' as const, text: 'Image too large (max 10MB)' }],
						isError: true
					};
				}

				const ext = contentType.split('/')[1]?.split(';')[0] || 'png';
				const filename = `upload_${Date.now()}.${ext}`;

				const file = new File([buffer], filename, { type: contentType });
				const attachment = await saveAttachment(db, noteId, file, userId);

				return {
					content: [{ type: 'text' as const, text: JSON.stringify(attachment, null, 2) }]
				};
			} catch (err) {
				return {
					content: [
						{
							type: 'text' as const,
							text: `Failed to upload image: ${err instanceof Error ? err.message : String(err)}`
						}
					],
					isError: true
				};
			}
		}
	);

	return server;
}
