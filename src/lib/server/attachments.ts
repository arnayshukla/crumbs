import { existsSync, mkdirSync } from 'fs';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { db } from './db/index.js';
import { attachments } from './db/schema.js';
import { eq } from 'drizzle-orm';

const DATA_DIR = process.env.DATA_DIR || './data';
const ATTACHMENTS_DIR = join(DATA_DIR, 'attachments');

// Ensure attachments directory exists
if (!existsSync(ATTACHMENTS_DIR)) {
	mkdirSync(ATTACHMENTS_DIR, { recursive: true });
}

export async function saveAttachment(
	noteId: string,
	file: File
): Promise<typeof attachments.$inferSelect> {
	const id = uuidv4();
	const ext = file.name.split('.').pop() || 'bin';
	const filename = `${id}.${ext}`;
	const filePath = join(ATTACHMENTS_DIR, filename);

	const buffer = Buffer.from(await file.arrayBuffer());
	await writeFile(filePath, buffer);

	const [attachment] = await db
		.insert(attachments)
		.values({
			id,
			noteId,
			filename: file.name,
			mimeType: file.type,
			size: file.size,
			path: filePath,
			createdAt: new Date()
		})
		.returning();

	return attachment;
}

export async function getAttachment(id: string) {
	return db.select().from(attachments).where(eq(attachments.id, id)).get();
}

export async function getAttachmentsByNote(noteId: string) {
	return db.select().from(attachments).where(eq(attachments.noteId, noteId));
}

export async function deleteAttachment(id: string) {
	const attachment = await getAttachment(id);
	if (attachment) {
		try {
			await unlink(attachment.path);
		} catch {
			// File may already be deleted
		}
		await db.delete(attachments).where(eq(attachments.id, id));
	}
}
