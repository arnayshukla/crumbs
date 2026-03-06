import { db } from '$lib/server/db/index.js';
import { notes, syncLog } from '$lib/server/db/schema.js';
import { eq, gt } from 'drizzle-orm';
import { extractTags } from '$lib/utils/tags.js';
import { syncNoteTags } from '$lib/server/tags.js';
import type { SyncQueueItem } from './idb.js';

/**
 * Process incoming sync changes from client.
 */
export async function processSyncPush(changes: SyncQueueItem[]): Promise<void> {
	const noteIdsToSyncTags: string[] = [];

	db.transaction((tx) => {
		for (const change of changes) {
			switch (change.operation) {
				case 'create':
				case 'update': {
					if (!change.data) continue;
					const existing = tx
						.select()
						.from(notes)
						.where(eq(notes.id, change.noteId))
						.get();

					if (existing) {
						if (change.timestamp > existing.updatedAt.getTime()) {
							tx.update(notes)
								.set({
									...change.data,
									updatedAt: new Date(change.timestamp),
									version: existing.version + 1
								})
								.where(eq(notes.id, change.noteId))
								.run();
						}
					} else if (change.operation === 'create' && change.data) {
						tx.insert(notes)
							.values({
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
							})
							.run();
					}

					if (change.data.title !== undefined || change.data.content !== undefined) {
						noteIdsToSyncTags.push(change.noteId);
					}
					break;
				}
				case 'delete': {
					tx.delete(notes).where(eq(notes.id, change.noteId)).run();
					break;
				}
			}

			tx.insert(syncLog)
				.values({
					noteId: change.noteId,
					operation: change.operation,
					timestamp: new Date(change.timestamp),
					clientId: 'default'
				})
				.run();
		}
	});

	for (const noteId of noteIdsToSyncTags) {
		const note = db.select().from(notes).where(eq(notes.id, noteId)).get();
		if (note) {
			const content = `${note.title} ${note.content}`;
			syncNoteTags(noteId, extractTags(content));
		}
	}
}

/**
 * Get all notes updated since a given timestamp.
 */
export async function getChangesSince(sinceTimestamp: number) {
	return db
		.select()
		.from(notes)
		.where(gt(notes.updatedAt, new Date(sinceTimestamp)))
		.all();
}
