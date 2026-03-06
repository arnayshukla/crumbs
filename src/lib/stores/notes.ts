import { writable, derived } from 'svelte/store';
import type { Note, NoteFilter, NoteCreate, NoteUpdate } from '$lib/types/index.js';
import { addToSyncQueue, putNote, deleteNoteFromIdb, getAllNotes } from '$lib/sync/idb.js';
import { showToast } from '$lib/stores/toast.js';

export const notes = writable<Note[]>([]);
export const currentFilter = writable<NoteFilter>('all');
export const selectedTag = writable<string | null>(null);

export const filteredNotes = derived(
	[notes, selectedTag, currentFilter],
	([$notes, $selectedTag, $filter]) => {
		let result = $notes;
		if ($filter === 'all') {
			result = result.filter((n) => !n.trashed && !n.archived);
		} else if ($filter === 'archived') {
			result = result.filter((n) => n.archived && !n.trashed);
		} else if ($filter === 'trashed') {
			result = result.filter((n) => n.trashed);
		}
		if ($selectedTag) {
			result = result.filter((n) => n.tags?.includes($selectedTag));
		}
		return result;
	}
);

export const pinnedNotes = derived(filteredNotes, ($notes) =>
	$notes.filter((n) => n.pinned)
);

export const unpinnedNotes = derived(filteredNotes, ($notes) =>
	$notes.filter((n) => !n.pinned)
);

export const allTags = derived(notes, ($notes) => {
	const tagSet = new Set<string>();
	$notes.forEach((n) => n.tags?.forEach((t) => tagSet.add(t)));
	return [...tagSet].sort();
});

function isNetworkError(err: unknown): boolean {
	return err instanceof TypeError;
}

export async function loadNotes(filter: NoteFilter = 'all') {
	try {
		const res = await fetch(`/api/notes?filter=${filter}`);
		if (res.ok) {
			const data = await res.json();
			notes.set(data);
			currentFilter.set(filter);
		}
	} catch (err) {
		if (isNetworkError(err)) {
			const cached = await getAllNotes();
			if (cached.length > 0) {
				notes.set(cached);
				currentFilter.set(filter);
			}
		}
	}
}

export async function createNote(note: NoteCreate): Promise<Note | null> {
	try {
		const res = await fetch('/api/notes', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(note)
		});
		if (res.ok) {
			const created = await res.json();
			notes.update((list) => [created, ...list]);
			return created;
		}
		return null;
	} catch (err) {
		if (isNetworkError(err)) {
			const now = new Date();
			const optimistic: Note = {
				id: crypto.randomUUID(),
				title: note.title ?? '',
				content: note.content ?? '',
				color: note.color ?? 'default',
				pinned: note.pinned ?? false,
				archived: false,
				trashed: false,
				trashedAt: null,
				checklistMode: note.checklistMode ?? false,
				sortOrder: 0,
				createdAt: now,
				updatedAt: now,
				version: 1
			};
			notes.update((list) => [optimistic, ...list]);
			await putNote(optimistic);
			await addToSyncQueue({ noteId: optimistic.id, operation: 'create', data: optimistic, timestamp: Date.now() });
			showToast('Saved offline — will sync when reconnected', 'info');
			return optimistic;
		}
		return null;
	}
}

export async function updateNote(id: string, updates: NoteUpdate): Promise<Note | null> {
	try {
		const res = await fetch(`/api/notes/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(updates)
		});
		if (res.ok) {
			const updated = await res.json();
			notes.update((list) => list.map((n) => (n.id === id ? updated : n)));
			return updated;
		}
		showToast('Failed to save note', 'error');
		return null;
	} catch (err) {
		if (isNetworkError(err)) {
			let optimistic: Note | null = null;
			notes.update((list) =>
				list.map((n) => {
					if (n.id === id) {
						optimistic = { ...n, ...updates, updatedAt: new Date() };
						return optimistic;
					}
					return n;
				})
			);
			if (optimistic) {
				await putNote(optimistic);
				await addToSyncQueue({ noteId: id, operation: 'update', data: updates, timestamp: Date.now() });
				showToast('Saved offline — will sync when reconnected', 'info');
			}
			return optimistic;
		}
		return null;
	}
}

export async function deleteNote(id: string): Promise<boolean> {
	try {
		const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
		if (res.ok) {
			notes.update((list) => list.filter((n) => n.id !== id));
			return true;
		}
		return false;
	} catch (err) {
		if (isNetworkError(err)) {
			notes.update((list) => list.filter((n) => n.id !== id));
			await deleteNoteFromIdb(id);
			await addToSyncQueue({ noteId: id, operation: 'delete', timestamp: Date.now() });
			showToast('Saved offline — will sync when reconnected', 'info');
			return true;
		}
		return false;
	}
}

export async function trashNote(id: string): Promise<Note | null> {
	return updateNote(id, { trashed: true });
}

export async function restoreNote(id: string): Promise<Note | null> {
	return updateNote(id, { trashed: false });
}

export async function archiveNote(id: string): Promise<Note | null> {
	return updateNote(id, { archived: true });
}

export async function unarchiveNote(id: string): Promise<Note | null> {
	return updateNote(id, { archived: false });
}

export async function togglePin(id: string, currentPinned: boolean): Promise<Note | null> {
	return updateNote(id, { pinned: !currentPinned });
}
