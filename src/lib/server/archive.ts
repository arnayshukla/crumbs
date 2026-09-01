import { ZipArchive } from 'archiver';
import unzipper from 'unzipper';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { v4 as uuidv4 } from 'uuid';
import YAML from 'yaml';
import { z } from 'zod';
import type { Db } from './db/index.js';
import { sqlite } from './db/index.js';
import { attachments, notes, userPreferences } from './db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { extractTags } from '$lib/utils/tags.js';
import { syncNoteTags } from './tags.js';

const DATA_DIR = process.env.DATA_DIR || './data';
const DATABASE_URL = process.env.DATABASE_URL || join(DATA_DIR, 'crumbs.db');
const ATTACHMENTS_DIR = join(DATA_DIR, 'attachments');
const MAX_IMPORT_BYTES = 512 * 1024 * 1024;
const MAX_ENTRIES = 10_000;
const FORMAT_VERSION = 1;

const portableNoteSchema = z.object({
	sourceId: z.string(),
	path: z.string(),
	title: z.string(),
	color: z.string(),
	pinned: z.boolean(),
	archived: z.boolean(),
	trashed: z.boolean(),
	checklistMode: z.boolean(),
	sortOrder: z.number().int(),
	createdAt: z.string(),
	updatedAt: z.string()
});
const portableAttachmentSchema = z.object({
	sourceId: z.string(), sourceNoteId: z.string(), path: z.string(), thumbnailPath: z.string().optional(),
	filename: z.string(), mimeType: z.string(), size: z.number().int().nonnegative(), featured: z.boolean(), createdAt: z.string()
});
const portableManifestSchema = z.object({
	kind: z.literal('crumbs-portable'), formatVersion: z.literal(FORMAT_VERSION), exportedAt: z.string(),
	notes: z.array(portableNoteSchema), attachments: z.array(portableAttachmentSchema), preferences: z.record(z.string(), z.string())
});
const instanceManifestSchema = z.object({
	kind: z.literal('crumbs-instance'), formatVersion: z.literal(FORMAT_VERSION), exportedAt: z.string(),
	files: z.record(z.string(), z.object({ size: z.number().int().nonnegative(), sha256: z.string().length(64) }))
});

function isSafeArchivePath(path: string): boolean {
	const normalized = normalize(path).replaceAll('\\', '/');
	return !normalized.startsWith('/') && !normalized.startsWith('../') && !normalized.includes('/../') && path !== '';
}

function markdownDocument(note: typeof notes.$inferSelect): string {
	const frontmatter = YAML.stringify({
		title: note.title, color: note.color, pinned: note.pinned, archived: note.archived,
		trashed: note.trashed, checklistMode: note.checklistMode, sortOrder: note.sortOrder,
		createdAt: note.createdAt.toISOString(), updatedAt: note.updatedAt.toISOString(), sourceId: note.id
	}).trim();
	return `---\n${frontmatter}\n---\n\n${note.content}`;
}

function markdownBody(document: string): string {
	const match = document.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n(?:\r?\n)?/);
	return match ? document.slice(match[0].length) : document;
}

function sha256(buffer: Buffer): string {
	return createHash('sha256').update(buffer).digest('hex');
}

export function createPortableArchive(db: Db, userId: number): Readable {
	const ownedNotes = db.select().from(notes).where(eq(notes.userId, userId)).all();
	const noteIds = ownedNotes.map((note) => note.id);
	const ownedAttachments = noteIds.length === 0 ? [] : db.select().from(attachments).where(inArray(attachments.noteId, noteIds)).all();
	const preferences = Object.fromEntries(db.select({ key: userPreferences.key, value: userPreferences.value }).from(userPreferences).where(eq(userPreferences.userId, userId)).all().map((row) => [row.key, row.value]));
	const noteEntries = ownedNotes.map((note, index) => ({
		sourceId: note.id, path: `notes/${String(index + 1).padStart(4, '0')}-${note.id}.md`, title: note.title,
		color: note.color, pinned: note.pinned, archived: note.archived, trashed: note.trashed,
		checklistMode: note.checklistMode, sortOrder: note.sortOrder, createdAt: note.createdAt.toISOString(), updatedAt: note.updatedAt.toISOString()
	}));
	const attachmentEntries = ownedAttachments.map((attachment) => ({
		sourceId: attachment.id, sourceNoteId: attachment.noteId, path: `attachments/${attachment.id}${extname(attachment.path)}`,
		thumbnailPath: attachment.thumbnailPath ? `attachments/${attachment.id}-thumb${extname(attachment.thumbnailPath) || '.webp'}` : undefined,
		filename: attachment.filename, mimeType: attachment.mimeType, size: attachment.size, featured: attachment.featured, createdAt: attachment.createdAt.toISOString()
	}));
	const archive = new ZipArchive({ zlib: { level: 6 } });
	archive.append(JSON.stringify({ kind: 'crumbs-portable', formatVersion: FORMAT_VERSION, exportedAt: new Date().toISOString(), notes: noteEntries, attachments: attachmentEntries, preferences }, null, 2), { name: 'manifest.json' });
	ownedNotes.forEach((note, index) => archive.append(markdownDocument(note), { name: noteEntries[index].path }));
	ownedAttachments.forEach((attachment, index) => {
		if (existsSync(attachment.path)) archive.file(attachment.path, { name: attachmentEntries[index].path });
		if (attachment.thumbnailPath && attachmentEntries[index].thumbnailPath && existsSync(attachment.thumbnailPath)) archive.file(attachment.thumbnailPath, { name: attachmentEntries[index].thumbnailPath });
	});
	void archive.finalize();
	return archive;
}

async function openArchive(file: File) {
	if (file.size <= 0 || file.size > MAX_IMPORT_BYTES) throw new Error('Archive must be between 1 byte and 512 MB');
	const directory = await unzipper.Open.buffer(Buffer.from(await file.arrayBuffer()));
	if (directory.files.length > MAX_ENTRIES) throw new Error('Archive contains too many files');
	let expandedBytes = 0;
	for (const entry of directory.files) {
		if (!isSafeArchivePath(entry.path) || entry.type !== 'File') throw new Error('Archive contains an unsafe path or entry');
		expandedBytes += entry.uncompressedSize;
		if (entry.uncompressedSize > MAX_IMPORT_BYTES || expandedBytes > MAX_IMPORT_BYTES * 2) throw new Error('Expanded archive is too large');
	}
	return directory;
}

export async function importPortableArchive(db: Db, userId: number, file: File): Promise<{ notes: number; attachments: number }> {
	const directory = await openArchive(file);
	const byPath = new Map(directory.files.map((entry) => [entry.path, entry]));
	const manifestEntry = byPath.get('manifest.json');
	if (!manifestEntry) throw new Error('Archive manifest is missing');
	const manifest = portableManifestSchema.parse(JSON.parse((await manifestEntry.buffer()).toString('utf8')));
	const noteIdMap = new Map(manifest.notes.map((note) => [note.sourceId, uuidv4()]));
	const attachmentIdMap = new Map(manifest.attachments.map((attachment) => [attachment.sourceId, uuidv4()]));
	const staged = await mkdtemp(join(tmpdir(), 'crumbs-import-'));
	const written: string[] = [];
	try {
		await mkdir(ATTACHMENTS_DIR, { recursive: true });
		const attachmentRows: Array<typeof attachments.$inferInsert> = [];
		for (const item of manifest.attachments) {
			const entry = byPath.get(item.path);
			const targetNoteId = noteIdMap.get(item.sourceNoteId);
			const targetId = attachmentIdMap.get(item.sourceId);
			if (!entry || !targetNoteId || !targetId) throw new Error(`Attachment entry is missing: ${item.path}`);
			const extension = extname(item.path).slice(0, 12) || '.bin';
			const targetPath = join(ATTACHMENTS_DIR, `${targetId}${extension}`);
			const stagedPath = join(staged, basename(targetPath));
			await writeFile(stagedPath, await entry.buffer());
			let thumbnailPath: string | null = null;
			if (item.thumbnailPath) {
				const thumbEntry = byPath.get(item.thumbnailPath);
				if (!thumbEntry) throw new Error(`Thumbnail entry is missing: ${item.thumbnailPath}`);
				thumbnailPath = join(ATTACHMENTS_DIR, `${targetId}_thumb.webp`);
				await writeFile(join(staged, basename(thumbnailPath)), await thumbEntry.buffer());
			}
			attachmentRows.push({ id: targetId, userId, noteId: targetNoteId, filename: item.filename, mimeType: item.mimeType, size: item.size, path: targetPath, thumbnailPath, featured: item.featured, createdAt: new Date(item.createdAt) });
		}

		const noteRows = await Promise.all(manifest.notes.map(async (item) => {
			const entry = byPath.get(item.path);
			if (!entry) throw new Error(`Crumb entry is missing: ${item.path}`);
			const document = (await entry.buffer()).toString('utf8');
			let content = markdownBody(document);
			for (const [oldId, newId] of noteIdMap) content = content.replaceAll(`/api/notes/${oldId}/`, `/api/notes/${newId}/`);
			for (const [oldId, newId] of attachmentIdMap) content = content.replaceAll(`attachmentId=${oldId}`, `attachmentId=${newId}`);
			return { id: noteIdMap.get(item.sourceId)!, userId, title: item.title, content, color: item.color, pinned: item.pinned, archived: item.archived, trashed: item.trashed, trashedAt: item.trashed ? new Date() : null, checklistMode: item.checklistMode, sortOrder: item.sortOrder, createdAt: new Date(item.createdAt), updatedAt: new Date(item.updatedAt), version: 1 };
		}));

		for (const row of attachmentRows) {
			const source = join(staged, basename(row.path));
			await writeFile(row.path, await readFile(source));
			written.push(row.path);
			if (row.thumbnailPath) {
				await writeFile(row.thumbnailPath, await readFile(join(staged, basename(row.thumbnailPath))));
				written.push(row.thumbnailPath);
			}
		}

		db.transaction((tx) => {
			for (const row of noteRows) {
				tx.insert(notes).values(row).run();
				syncNoteTags(tx as Db, row.id, extractTags(`${row.title} ${row.content}`), userId);
			}
			if (attachmentRows.length > 0) tx.insert(attachments).values(attachmentRows).run();
			for (const [key, value] of Object.entries(manifest.preferences)) tx.insert(userPreferences).values({ userId, key, value, updatedAt: new Date() }).onConflictDoUpdate({ target: [userPreferences.userId, userPreferences.key], set: { value, updatedAt: new Date() } }).run();
		});
		return { notes: noteRows.length, attachments: attachmentRows.length };
	} catch (error) {
		await Promise.all(written.map((path) => rm(path, { force: true })));
		throw error;
	} finally {
		await rm(staged, { recursive: true, force: true });
	}
}

export async function createInstanceArchive(): Promise<Readable> {
	const temporary = await mkdtemp(join(tmpdir(), 'crumbs-backup-'));
	const snapshotPath = join(temporary, 'crumbs.db');
	await sqlite.backup(snapshotPath);
	const files: Record<string, { size: number; sha256: string }> = {};
	const databaseBuffer = await readFile(snapshotPath);
	files['database/crumbs.db'] = { size: databaseBuffer.length, sha256: sha256(databaseBuffer) };
	const archive = new ZipArchive({ zlib: { level: 6 } });
	archive.file(snapshotPath, { name: 'database/crumbs.db' });
	if (existsSync(ATTACHMENTS_DIR)) {
		const attachmentFiles = await import('node:fs/promises').then(({ readdir }) => readdir(ATTACHMENTS_DIR));
		for (const name of attachmentFiles) {
			const path = join(ATTACHMENTS_DIR, name);
			const buffer = await readFile(path);
			files[`attachments/${name}`] = { size: buffer.length, sha256: sha256(buffer) };
			archive.file(path, { name: `attachments/${name}` });
		}
	}
	archive.append(JSON.stringify({ kind: 'crumbs-instance', formatVersion: FORMAT_VERSION, exportedAt: new Date().toISOString(), files }, null, 2), { name: 'manifest.json' });
	archive.on('end', () => void rm(temporary, { recursive: true, force: true }));
	void archive.finalize();
	return archive;
}

export async function stageInstanceRestore(file: File): Promise<{ files: number; restartRequired: true }> {
	const directory = await openArchive(file);
	const byPath = new Map(directory.files.map((entry) => [entry.path, entry]));
	const manifestEntry = byPath.get('manifest.json');
	if (!manifestEntry) throw new Error('Archive manifest is missing');
	const manifest = instanceManifestSchema.parse(JSON.parse((await manifestEntry.buffer()).toString('utf8')));
	if (!manifest.files['database/crumbs.db']) throw new Error('Database snapshot is missing');
	for (const [path, expected] of Object.entries(manifest.files)) {
		if (path !== 'database/crumbs.db' && !path.startsWith('attachments/')) throw new Error('Archive contains an unexpected file');
		const entry = byPath.get(path);
		if (!entry) throw new Error(`Archive file is missing: ${path}`);
		const buffer = await entry.buffer();
		if (buffer.length !== expected.size || sha256(buffer) !== expected.sha256) throw new Error(`Checksum failed: ${path}`);
	}
	const pending = join(DATA_DIR, 'restore-pending');
	const staging = join(DATA_DIR, `restore-staging-${uuidv4()}`);
	try {
		await mkdir(join(staging, 'attachments'), { recursive: true });
		for (const path of Object.keys(manifest.files)) {
			const target = path === 'database/crumbs.db' ? join(staging, 'crumbs.db') : join(staging, path);
			await mkdir(dirname(target), { recursive: true });
			await writeFile(target, await byPath.get(path)!.buffer());
		}
		await writeFile(join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2));
		await rm(pending, { recursive: true, force: true });
		await rename(staging, pending);
		return { files: Object.keys(manifest.files).length, restartRequired: true };
	} catch (cause) {
		await rm(staging, { recursive: true, force: true });
		throw cause;
	}
}

export function nodeStreamResponse(stream: Readable, filename: string): Response {
	return new Response(Readable.toWeb(stream) as ReadableStream, {
		headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
	});
}
