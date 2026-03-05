import { db } from '$lib/server/db/index.js';
import { notes, syncLog } from '$lib/server/db/schema.js';
import { eq, gt } from 'drizzle-orm';
import type { SyncQueueItem } from './idb.js';

/**
 * Process incoming sync changes from client.
 */
export async function processSyncPush(changes: SyncQueueItem[]): Promise<void> {
	for (const change of changes) {
		switch (change.operation) {
			case 'create':
			case 'update': {
				if (!change.data) continue;
				const existing = await db.select().from(notes).where(eq(notes.id, change.noteId)).get();

				if (existing) {
					// LWW: only update if incoming timestamp is newer
					if (change.timestamp > existing.updatedAt.getTime()) {
						await db
							.update(notes)
							.set({
								...change.data,
								updatedAt: new Date(change.timestamp),
								version: existing.version + 1
							})
							.where(eq(notes.id, change.noteId));
					}
				} else if (change.operation === 'create' && change.data) {
					await db.insert(notes).values({
						id: change.noteId,
						title: change.data.title || '',
						content: change.data.content || '',
						color: change.data.color || 'default',
						pinned: change.data.pinned || false,
						archived: change.data.archived || false,
						trashed: change.data.trashed || false,
						checklistMode: change.data.checklistMode || false,
						sortOrder: change.data.sortOrder || 0,
						createdAt: new Date(change.timestamp),
						updatedAt: new Date(change.timestamp),
						version: 1
					});
				}
				break;
			}
			case 'delete': {
				await db.delete(notes).where(eq(notes.id, change.noteId));
				break;
			}
		}

		// Log sync operation
		await db.insert(syncLog).values({
			noteId: change.noteId,
			operation: change.operation,
			timestamp: new Date(change.timestamp),
			clientId: 'default'
		});
	}
}

/**
 * Get all notes updated since a given timestamp.
 */
export async function getChangesSince(sinceTimestamp: number) {
	const since = new Date(sinceTimestamp);
	const allNotes = await db.select().from(notes);
	// Filter notes updated after the timestamp
	return allNotes.filter((n) => n.updatedAt > since);
}
