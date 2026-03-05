import type { Note } from '$lib/types/index.js';

/**
 * Last-Write-Wins (LWW) merge strategy per field.
 * For a single-user app with multiple devices, this is sufficient.
 * Each field is resolved by comparing updatedAt timestamps.
 */
export function mergeNotes(local: Note, remote: Note): Note {
	// If remote is newer overall, take remote
	const localTime = new Date(local.updatedAt).getTime();
	const remoteTime = new Date(remote.updatedAt).getTime();

	if (remoteTime > localTime) {
		return { ...remote };
	}

	if (localTime > remoteTime) {
		return { ...local };
	}

	// Same timestamp - prefer higher version number
	if (remote.version > local.version) {
		return { ...remote };
	}

	return { ...local };
}

/**
 * Determine if a local note has changes compared to a remote note.
 */
export function hasChanges(local: Note, remote: Note): boolean {
	return (
		local.title !== remote.title ||
		local.content !== remote.content ||
		local.color !== remote.color ||
		local.pinned !== remote.pinned ||
		local.archived !== remote.archived ||
		local.trashed !== remote.trashed ||
		local.checklistMode !== remote.checklistMode ||
		local.sortOrder !== remote.sortOrder
	);
}

/**
 * Generate a diff of changed fields between two notes.
 */
export function diffNotes(
	oldNote: Note,
	newNote: Note
): Partial<Note> {
	const diff: Partial<Note> = {};

	if (oldNote.title !== newNote.title) diff.title = newNote.title;
	if (oldNote.content !== newNote.content) diff.content = newNote.content;
	if (oldNote.color !== newNote.color) diff.color = newNote.color;
	if (oldNote.pinned !== newNote.pinned) diff.pinned = newNote.pinned;
	if (oldNote.archived !== newNote.archived) diff.archived = newNote.archived;
	if (oldNote.trashed !== newNote.trashed) diff.trashed = newNote.trashed;
	if (oldNote.checklistMode !== newNote.checklistMode) diff.checklistMode = newNote.checklistMode;
	if (oldNote.sortOrder !== newNote.sortOrder) diff.sortOrder = newNote.sortOrder;

	return diff;
}
