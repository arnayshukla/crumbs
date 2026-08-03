# Note Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a note reference another note by ID via the existing link toolbar, rendered as a live tiptap node whose label always tracks the target's current title, with a backlinks ("Referenced by") section on the target note.

**Architecture:** A new self-referential `noteLinks` join table (mirroring the existing `noteTags` pattern) tracks which notes reference which. A new atomic tiptap node (`NoteLink`, not a mark) renders the live title from a synchronous in-memory title index built from IndexedDB at editor-mount time, round-trips through raw markdown as `[title](crumb-note://<id>)`, and is inserted via a note-search extension to the existing link toolbar dropdown.

**Tech Stack:** SvelteKit + Svelte 5 runes, Tailwind CSS v4, Drizzle ORM + better-sqlite3, tiptap 3 + tiptap-markdown, Vitest (unit), Playwright (e2e), pnpm.

## Global Constraints

- Light mode must not change; this feature touches no color variables.
- Never hardcode Tailwind colors — always reference CSS variables (project rule, `CLAUDE.md`).
- Run `pnpm check` before every commit — not just tests (project rule).
- Run `pnpm build` before `pnpm test:e2e` locally, or e2e tests run against a stale bundle.
- Conventional commit prefixes: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- Unit tests are co-located as `src/**/*.test.ts` (Vitest glob in `vitest.config.ts`), not under a separate `tests/unit/` directory — follow this existing convention, not the aspirational one in `CLAUDE.md`'s project-structure diagram.
- `src/lib/server/db/test-helpers.ts` hand-rolls its schema via raw `CREATE TABLE` statements rather than running real migrations — any new table added to `schema.ts` must also get a matching `CREATE TABLE` block there, or server-side unit tests will fail with "no such table".
- Backlinks are computed only in `getNote()` (single-note load), never in `hydrateNotes()` (which also backs list views) — see spec's Components section for why.
- Spec: `docs/superpowers/specs/2026-08-03-note-linking-design.md`

---

### Task 1: `noteLinks` schema, test-helper, and migration

**Files:**
- Modify: `src/lib/server/db/schema.ts`
- Modify: `src/lib/server/db/test-helpers.ts`
- Test: `src/lib/server/db/note-links-schema.test.ts` (new)
- Migration: generated under `drizzle/` via `pnpm db:generate`

**Interfaces:**
- Produces: `noteLinks` Drizzle table with columns `sourceNoteId: text`, `targetNoteId: text`, both `references(() => notes.id, { onDelete: 'cascade' })`. Exported from `src/lib/server/db/schema.ts`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/server/db/note-links-schema.test.ts
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from './test-helpers.js';
import { notes, noteLinks, users } from './schema.js';

describe('noteLinks schema', () => {
	it('should store a source/target link row', () => {
		const { db } = createTestDb();
		db.insert(users)
			.values({ email: 'a@test.com', displayName: 'A', role: 'user', authProvider: 'password', createdAt: new Date() })
			.run();

		db.insert(notes)
			.values([
				{ id: 'source-note', userId: 1, title: 'Source', content: '', createdAt: new Date(), updatedAt: new Date() },
				{ id: 'target-note', userId: 1, title: 'Target', content: '', createdAt: new Date(), updatedAt: new Date() }
			])
			.run();

		db.insert(noteLinks).values({ sourceNoteId: 'source-note', targetNoteId: 'target-note' }).run();

		const rows = db.select().from(noteLinks).all();
		expect(rows).toEqual([{ sourceNoteId: 'source-note', targetNoteId: 'target-note' }]);
	});

	it('should cascade-delete link rows when the source note is deleted', () => {
		const { db, sqlite } = createTestDb();
		sqlite.pragma('foreign_keys = ON');
		db.insert(users)
			.values({ email: 'a@test.com', displayName: 'A', role: 'user', authProvider: 'password', createdAt: new Date() })
			.run();
		db.insert(notes)
			.values([
				{ id: 'source-note', userId: 1, title: 'Source', content: '', createdAt: new Date(), updatedAt: new Date() },
				{ id: 'target-note', userId: 1, title: 'Target', content: '', createdAt: new Date(), updatedAt: new Date() }
			])
			.run();
		db.insert(noteLinks).values({ sourceNoteId: 'source-note', targetNoteId: 'target-note' }).run();

		db.delete(notes).where(eq(notes.id, 'source-note')).run();

		expect(db.select().from(noteLinks).all()).toEqual([]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/server/db/note-links-schema.test.ts`
Expected: FAIL — `noteLinks` is not exported from `./schema.js`, and the table doesn't exist in the test DB.

- [ ] **Step 3: Add the schema table**

In `src/lib/server/db/schema.ts`, add after the existing `noteTags` table definition:

```typescript
export const noteLinks = sqliteTable(
	'note_links',
	{
		sourceNoteId: text('source_note_id')
			.references(() => notes.id, { onDelete: 'cascade' })
			.notNull(),
		targetNoteId: text('target_note_id')
			.references(() => notes.id, { onDelete: 'cascade' })
			.notNull()
	},
	(table) => [
		index('note_links_source_idx').on(table.sourceNoteId),
		index('note_links_target_idx').on(table.targetNoteId)
	]
);
```

- [ ] **Step 4: Add the matching raw table to test-helpers.ts**

In `src/lib/server/db/test-helpers.ts`, inside the `sqlite.exec(...)` template string, add right after the existing `note_tags` block:

```sql
		CREATE TABLE note_links (
			source_note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
			target_note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE
		);
		CREATE INDEX note_links_source_idx ON note_links(source_note_id);
		CREATE INDEX note_links_target_idx ON note_links(target_note_id);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/lib/server/db/note-links-schema.test.ts`
Expected: PASS (2 tests)

Note: the second test explicitly turns `foreign_keys` pragma `ON` because `createTestDb()` sets it `OFF` by default (matching production, where cascade is enforced by the app's real connection settings, not this hand-rolled test DB) — this test verifies the cascade FK constraint itself is correctly declared.

- [ ] **Step 6: Generate and apply the real migration**

Run: `pnpm db:generate`
Expected: a new file appears under `drizzle/`, e.g. `drizzle/00XX_<auto-name>.sql`, containing `CREATE TABLE note_links (...)` matching Step 3's schema.

Run: `pnpm db:migrate`
Expected: migration applies cleanly against `./data/crumbs.db` (or whatever `DATABASE_URL` points to) with no errors.

- [ ] **Step 7: Run full check and commit**

Run: `pnpm check && pnpm vitest run src/lib/server/db/note-links-schema.test.ts`
Expected: 0 type errors, tests pass.

```bash
git add src/lib/server/db/schema.ts src/lib/server/db/test-helpers.ts src/lib/server/db/note-links-schema.test.ts drizzle/
git commit -m "feat(db): add noteLinks table for note-to-note references"
```

---

### Task 2: `extractNoteLinks` pure utility

**Files:**
- Create: `src/lib/utils/note-links.ts`
- Test: `src/lib/utils/note-links.test.ts`

**Interfaces:**
- Consumes: nothing (pure function, no dependency on Task 1)
- Produces: `extractNoteLinks(content: string): string[]` — exported from `src/lib/utils/note-links.ts`. Extracts the note ID from every `crumb-note://<id>` occurrence in markdown content, deduped, in first-seen order.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/utils/note-links.test.ts
import { describe, it, expect } from 'vitest';
import { extractNoteLinks } from './note-links.js';

describe('extractNoteLinks', () => {
	it('should extract a single note-link reference', () => {
		expect(extractNoteLinks('See [Grocery List](crumb-note://abc-123)')).toEqual(['abc-123']);
	});

	it('should extract multiple distinct references', () => {
		const content = '[A](crumb-note://id-1) and [B](crumb-note://id-2)';
		expect(extractNoteLinks(content)).toEqual(['id-1', 'id-2']);
	});

	it('should deduplicate repeated references', () => {
		const content = '[A](crumb-note://id-1) again: [A again](crumb-note://id-1)';
		expect(extractNoteLinks(content)).toEqual(['id-1']);
	});

	it('should return an empty array for content with no note-links', () => {
		expect(extractNoteLinks('Just [a normal link](https://example.com)')).toEqual([]);
	});

	it('should return an empty array for empty content', () => {
		expect(extractNoteLinks('')).toEqual([]);
	});

	it('should not match crumb-note:// occurring inside a code block', () => {
		const content = '```\n[A](crumb-note://id-1)\n```';
		expect(extractNoteLinks(content)).toEqual([]);
	});

	it('should not match crumb-note:// occurring inside inline code', () => {
		expect(extractNoteLinks('Use `crumb-note://id-1` as an example')).toEqual([]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/utils/note-links.test.ts`
Expected: FAIL — cannot find module `./note-links.js`

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/utils/note-links.ts

/**
 * Extract crumb-note://<id> references from markdown content.
 * Mirrors extractTags' code-block/inline-code exclusion so a reference
 * mentioned as an example inside a code sample isn't treated as a real link.
 */
export function extractNoteLinks(content: string): string[] {
	if (!content) return [];

	const withoutCodeBlocks = content.replace(/```[\s\S]*?```/g, '');
	const withoutInlineCode = withoutCodeBlocks.replace(/`[^`]*`/g, '');

	const matches = withoutInlineCode.match(/crumb-note:\/\/([\w-]+)/g);
	if (!matches) return [];

	const ids = matches.map((m) => m.replace('crumb-note://', ''));
	return [...new Set(ids)];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/utils/note-links.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/note-links.ts src/lib/utils/note-links.test.ts
git commit -m "feat: add extractNoteLinks utility for parsing note-link references"
```

---

### Task 3: `syncNoteLinks` and `fetchBacklinksForNote`

**Files:**
- Create: `src/lib/server/note-links.ts`
- Test: `src/lib/server/note-links.test.ts`

**Interfaces:**
- Consumes: `noteLinks` table from Task 1 (`src/lib/server/db/schema.ts`); `canAccessNote` from `src/lib/server/api-utils.ts` (existing).
- Produces:
  - `syncNoteLinks(db: Db, noteId: string, targetIds: string[]): void`
  - `fetchBacklinksForNote(db: Db, noteId: string, userId: number): { id: string; title: string }[]`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/server/note-links.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './db/test-helpers.js';
import { notes, noteLinks, noteCollaborators, users } from './db/schema.js';
import type { Db } from './db/index.js';
import { syncNoteLinks, fetchBacklinksForNote } from './note-links.js';

let db: Db;
const OWNER_ID = 1;
const OTHER_USER_ID = 2;

function seedUser(id: number, email: string) {
	db.insert(users)
		.values({ id, email, displayName: email, role: 'user', authProvider: 'password', createdAt: new Date() })
		.run();
}

function seedNote(id: string, userId: number, title = '') {
	db.insert(notes)
		.values({ id, userId, title, content: '', createdAt: new Date(), updatedAt: new Date() })
		.run();
}

beforeEach(() => {
	const testDb = createTestDb();
	db = testDb.db;
	seedUser(OWNER_ID, 'owner@test.com');
	seedUser(OTHER_USER_ID, 'other@test.com');
});

describe('syncNoteLinks', () => {
	it('should create link rows for each target', () => {
		seedNote('source', OWNER_ID);
		seedNote('target-1', OWNER_ID);
		seedNote('target-2', OWNER_ID);

		syncNoteLinks(db, 'source', ['target-1', 'target-2']);

		const rows = db.select().from(noteLinks).all();
		expect(rows).toHaveLength(2);
	});

	it('should remove old links and add new ones on re-sync', () => {
		seedNote('source', OWNER_ID);
		seedNote('target-1', OWNER_ID);
		seedNote('target-2', OWNER_ID);

		syncNoteLinks(db, 'source', ['target-1']);
		syncNoteLinks(db, 'source', ['target-2']);

		const rows = db.select().from(noteLinks).all();
		expect(rows).toEqual([{ sourceNoteId: 'source', targetNoteId: 'target-2' }]);
	});

	it('should handle an empty target list (removes all links)', () => {
		seedNote('source', OWNER_ID);
		seedNote('target-1', OWNER_ID);

		syncNoteLinks(db, 'source', ['target-1']);
		syncNoteLinks(db, 'source', []);

		expect(db.select().from(noteLinks).all()).toEqual([]);
	});
});

describe('fetchBacklinksForNote', () => {
	it('should return notes that link to the given note', () => {
		seedNote('source', OWNER_ID, 'Source Note');
		seedNote('target', OWNER_ID, 'Target Note');
		syncNoteLinks(db, 'source', ['target']);

		const backlinks = fetchBacklinksForNote(db, 'target', OWNER_ID);
		expect(backlinks).toEqual([{ id: 'source', title: 'Source Note' }]);
	});

	it('should return an empty array when nothing links to the note', () => {
		seedNote('target', OWNER_ID, 'Target Note');
		expect(fetchBacklinksForNote(db, 'target', OWNER_ID)).toEqual([]);
	});

	it('should exclude a backlink from a source note the requesting user cannot access', () => {
		// OTHER_USER_ID owns "source" and links it to OWNER_ID's "target", but never
		// shared "source" with OWNER_ID — OWNER_ID must not see it in their backlinks.
		seedNote('source', OTHER_USER_ID, 'Other Users Note');
		seedNote('target', OWNER_ID, 'Target Note');
		syncNoteLinks(db, 'source', ['target']);

		expect(fetchBacklinksForNote(db, 'target', OWNER_ID)).toEqual([]);
	});

	it('should include a backlink from a source note shared with the requesting user', () => {
		seedNote('source', OTHER_USER_ID, 'Shared Source');
		seedNote('target', OWNER_ID, 'Target Note');
		syncNoteLinks(db, 'source', ['target']);
		db.insert(noteCollaborators)
			.values({ noteId: 'source', userId: OWNER_ID, addedBy: OTHER_USER_ID, addedAt: new Date() })
			.run();

		expect(fetchBacklinksForNote(db, 'target', OWNER_ID)).toEqual([{ id: 'source', title: 'Shared Source' }]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/server/note-links.test.ts`
Expected: FAIL — cannot find module `./note-links.js`

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/server/note-links.ts
import type { Db } from './db/index.js';
import { noteLinks, notes } from './db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { canAccessNote } from './api-utils.js';

/**
 * Sync link rows for a note: removes old associations, inserts the current set.
 * Mirrors syncNoteTags — called right after a note's content is saved.
 */
export function syncNoteLinks(db: Db, noteId: string, targetIds: string[]): void {
	db.delete(noteLinks).where(eq(noteLinks.sourceNoteId, noteId)).run();

	for (const targetId of targetIds) {
		db.insert(noteLinks).values({ sourceNoteId: noteId, targetNoteId: targetId }).run();
	}
}

/**
 * Find notes that link to the given note, scoped to what the requesting user
 * can access — this both respects normal sharing boundaries and, as a side
 * effect, prevents an unrelated note from appearing in someone's backlinks
 * just because it happens to reference a note ID it was never shared to see.
 */
export function fetchBacklinksForNote(
	db: Db,
	noteId: string,
	userId: number
): { id: string; title: string }[] {
	const linkRows = db
		.select({ sourceNoteId: noteLinks.sourceNoteId })
		.from(noteLinks)
		.where(eq(noteLinks.targetNoteId, noteId))
		.all();

	if (linkRows.length === 0) return [];

	const sourceIds = linkRows.map((r) => r.sourceNoteId);
	const accessibleIds = sourceIds.filter((id) => canAccessNote(db, id, userId).canAccess);
	if (accessibleIds.length === 0) return [];

	const sourceNotes = db
		.select({ id: notes.id, title: notes.title })
		.from(notes)
		.where(inArray(notes.id, accessibleIds))
		.all();

	return sourceNotes;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/server/note-links.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/note-links.ts src/lib/server/note-links.test.ts
git commit -m "feat: add syncNoteLinks and fetchBacklinksForNote server functions"
```

---

### Task 4: Wire link sync and backlinks into `notes-service.ts`

**Files:**
- Modify: `src/lib/server/notes-service.ts`
- Modify: `src/lib/types/index.ts`
- Test: `src/lib/server/notes-service.test.ts` (existing file — add new `describe` blocks)

**Interfaces:**
- Consumes: `extractNoteLinks` (Task 2), `syncNoteLinks`/`fetchBacklinksForNote` (Task 3)
- Produces: `Note.backlinks?: NoteBacklink[]` type field; `createNote`/`updateNote` now sync note-links; `getNote` now returns `backlinks`

- [ ] **Step 1: Write the failing tests**

Add to the end of `src/lib/server/notes-service.test.ts`. This file already declares a module-level `let db: Db;`, a constant `const OWNER_ID = 1;`, and a `beforeEach` that creates a fresh test DB and seeds both `OWNER_ID` and a second `COLLAB_ID` user — reuse `db` and `OWNER_ID` as-is, don't redeclare them:

```typescript
describe('note links', () => {
	it('should sync note-links when a note is created with a reference', () => {
		const target = createNote(db, OWNER_ID, { title: 'Target' });
		const source = createNote(db, OWNER_ID, {
			title: 'Source',
			content: `See [Target](crumb-note://${target.id})`
		});

		const reopened = getNote(db, OWNER_ID, target.id);
		expect(reopened?.backlinks).toEqual([{ id: source.id, title: 'Source' }]);
	});

	it('should sync note-links when a note is updated with a reference', () => {
		const target = createNote(db, OWNER_ID, { title: 'Target' });
		const source = createNote(db, OWNER_ID, { title: 'Source', content: '' });

		updateNote(db, OWNER_ID, source.id, { content: `See [Target](crumb-note://${target.id})` });

		const reopened = getNote(db, OWNER_ID, target.id);
		expect(reopened?.backlinks).toEqual([{ id: source.id, title: 'Source' }]);
	});

	it('should remove a backlink when the referencing note is edited to drop the reference', () => {
		const target = createNote(db, OWNER_ID, { title: 'Target' });
		const source = createNote(db, OWNER_ID, {
			title: 'Source',
			content: `See [Target](crumb-note://${target.id})`
		});

		updateNote(db, OWNER_ID, source.id, { content: 'No longer references anything' });

		const reopened = getNote(db, OWNER_ID, target.id);
		expect(reopened?.backlinks).toEqual([]);
	});

	it('should return an empty backlinks array for a note nothing links to', () => {
		const note = createNote(db, OWNER_ID, { title: 'Lonely note' });
		const reopened = getNote(db, OWNER_ID, note.id);
		expect(reopened?.backlinks).toEqual([]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/server/notes-service.test.ts`
Expected: FAIL — `backlinks` is `undefined` on the returned note (createNote/updateNote don't sync links yet, getNote doesn't attach them)

- [ ] **Step 3: Add the `backlinks` field to the `Note` type**

In `src/lib/types/index.ts`, add near the other optional hydration fields:

```typescript
export interface NoteBacklink {
	id: string;
	title: string;
}
```

Add `backlinks?: NoteBacklink[];` to the `Note` interface, right after `shareToken?: string;`.

- [ ] **Step 4: Wire sync calls into `createNote` and `updateNote`**

In `src/lib/server/notes-service.ts`, add the import:

```typescript
import { extractNoteLinks } from '$lib/utils/note-links.js';
import { syncNoteLinks, fetchBacklinksForNote } from './note-links.js';
```

In `createNote`, right after the existing `syncNoteTags(db, id, extractedTags, userId);` line:

```typescript
	const extractedLinks = extractNoteLinks(content);
	syncNoteLinks(db, id, extractedLinks);
```

In `updateNote`, right after the existing `syncNoteTags(db, id, extractedTags, existing.userId);` line (inside the `if (input.title !== undefined || input.content !== undefined)` block):

```typescript
			const extractedLinks = extractNoteLinks(content);
			syncNoteLinks(db, id, extractedLinks);
```

- [ ] **Step 5: Attach backlinks in `getNote`**

In `src/lib/server/notes-service.ts`, change `getNote`'s return from:

```typescript
	const result = hydrateNotes(db, [effectiveNote], userId);
	return result[0] ?? null;
```

to:

```typescript
	const result = hydrateNotes(db, [effectiveNote], userId);
	const hydrated = result[0];
	if (!hydrated) return null;

	return { ...hydrated, backlinks: fetchBacklinksForNote(db, id, userId) };
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run src/lib/server/notes-service.test.ts`
Expected: PASS (all existing tests plus the 4 new ones)

- [ ] **Step 7: Run full check and commit**

Run: `pnpm check`
Expected: 0 errors

```bash
git add src/lib/server/notes-service.ts src/lib/types/index.ts src/lib/server/notes-service.test.ts
git commit -m "feat: sync note-links on save and attach backlinks to getNote"
```

---

### Task 5: `NoteLink` tiptap node — definition, parse/serialize, pure helpers

**Files:**
- Create: `src/lib/components/tiptap/note-link-markdown.ts`
- Create: `src/lib/components/tiptap/NoteLink.ts`
- Test: `src/lib/components/tiptap/note-link-markdown.test.ts`

**Interfaces:**
- Produces:
  - `parseNoteLinkHref(href: string): string | null` — extracts the note ID from a `crumb-note://<id>` href, or `null` if the href doesn't match that scheme.
  - `serializeNoteLinkMarkdown(noteId: string, titleIndex: Map<string, string>): string` — produces the `[title](crumb-note://<id>)` markdown string, falling back to `'Untitled'` if the ID isn't in the index.
  - `NoteLink` — a tiptap `Node` extension (registered in Task 6).

This task deliberately keeps the two pure functions in their own file, separate from the tiptap `Node.create(...)` wiring — mounting a full interactive tiptap `Editor` in Vitest would need jsdom plus DOM APIs ProseMirror's view layer needs that jsdom doesn't fully provide, and this codebase has no existing precedent for that (every other rich-editor behavior — bold, links, task lists — is tested via Playwright e2e instead, in Task 11). The parse/serialize *logic* is ordinary string logic, though, and is fully testable in isolation.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/components/tiptap/note-link-markdown.test.ts
import { describe, it, expect } from 'vitest';
import { parseNoteLinkHref, serializeNoteLinkMarkdown } from './note-link-markdown.js';

describe('parseNoteLinkHref', () => {
	it('should extract the note ID from a crumb-note:// href', () => {
		expect(parseNoteLinkHref('crumb-note://abc-123')).toBe('abc-123');
	});

	it('should return null for a non-crumb-note href', () => {
		expect(parseNoteLinkHref('https://example.com')).toBeNull();
	});

	it('should return null for an empty string', () => {
		expect(parseNoteLinkHref('')).toBeNull();
	});
});

describe('serializeNoteLinkMarkdown', () => {
	it('should produce a markdown link with the title from the index', () => {
		const titleIndex = new Map([['abc-123', 'Grocery List']]);
		expect(serializeNoteLinkMarkdown('abc-123', titleIndex)).toBe('[Grocery List](crumb-note://abc-123)');
	});

	it('should fall back to Untitled when the ID is not in the index', () => {
		const titleIndex = new Map<string, string>();
		expect(serializeNoteLinkMarkdown('missing-id', titleIndex)).toBe('[Untitled](crumb-note://missing-id)');
	});

	it('should escape markdown-special characters in the title', () => {
		const titleIndex = new Map([['id-1', 'Buy [milk] today']]);
		expect(serializeNoteLinkMarkdown('id-1', titleIndex)).toBe('[Buy \\[milk\\] today](crumb-note://id-1)');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/components/tiptap/note-link-markdown.test.ts`
Expected: FAIL — cannot find module `./note-link-markdown.js`

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/components/tiptap/note-link-markdown.ts

const NOTE_LINK_SCHEME = 'crumb-note://';

/** Extracts the note ID from a crumb-note:// href, or null if it's not that scheme. */
export function parseNoteLinkHref(href: string): string | null {
	if (!href.startsWith(NOTE_LINK_SCHEME)) return null;
	return href.slice(NOTE_LINK_SCHEME.length) || null;
}

/**
 * Escapes markdown-special characters the same way a plain link's visible
 * text is escaped, so a title containing `[`, `]`, `*`, etc. can't corrupt
 * the surrounding markdown syntax.
 */
function escapeMarkdownText(text: string): string {
	return text.replace(/[[\]\\*_`]/g, '\\$&');
}

/** Produces the `[title](crumb-note://id)` markdown representation of a note-link. */
export function serializeNoteLinkMarkdown(noteId: string, titleIndex: Map<string, string>): string {
	const title = titleIndex.get(noteId) ?? 'Untitled';
	return `[${escapeMarkdownText(title)}](${NOTE_LINK_SCHEME}${noteId})`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/components/tiptap/note-link-markdown.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Define the `NoteLink` node (parse/serialize wiring, no NodeView yet)**

This step has no dedicated automated test — the node's actual rendering and interactivity is exercised end-to-end once Task 6 gives it a `NodeView`, and verified fully in Task 11's e2e suite. Writing it now, alongside the tested pure functions above, keeps Task 6 focused purely on the `NodeView`/wiring.

```typescript
// src/lib/components/tiptap/NoteLink.ts
import { Node, mergeAttributes } from '@tiptap/core';
import { parseNoteLinkHref, serializeNoteLinkMarkdown } from './note-link-markdown.js';

export interface NoteLinkOptions {
	titleIndex: Map<string, string>;
	onOpenNote: (noteId: string) => void;
}

export const NoteLink = Node.create<NoteLinkOptions>({
	name: 'noteLink',
	group: 'inline',
	inline: true,
	atom: true,

	addOptions() {
		return {
			titleIndex: new Map<string, string>(),
			onOpenNote: () => {}
		};
	},

	addAttributes() {
		return {
			noteId: {
				default: null,
				parseHTML: (element) => element.getAttribute('data-note-id'),
				renderHTML: (attributes) => ({ 'data-note-id': attributes.noteId })
			}
		};
	},

	parseHTML() {
		return [
			{
				tag: 'a[href^="crumb-note://"]',
				// Higher than the default rule priority (50) so this node claims
				// crumb-note:// anchors before the generic Link mark's a[href] rule —
				// belt-and-suspenders on top of Link's own protocol allow-list, which
				// already rejects this scheme by default.
				priority: 100,
				getAttrs: (element) => {
					const href = (element as HTMLElement).getAttribute('href') ?? '';
					const noteId = parseNoteLinkHref(href);
					return noteId ? { noteId } : false;
				}
			}
		];
	},

	renderHTML({ HTMLAttributes }) {
		return ['a', mergeAttributes(HTMLAttributes, { href: `crumb-note://${HTMLAttributes['data-note-id']}` })];
	},

	addStorage() {
		return {
			markdown: {
				serialize: (state: { write: (s: string) => void }, node: { attrs: { noteId: string } }) => {
					state.write(serializeNoteLinkMarkdown(node.attrs.noteId, this.options.titleIndex));
				},
				parse: {
					// No setup/updateDOM needed: markdown-it already renders standard
					// `[text](url)` syntax to a plain <a href> tag, which the parseHTML
					// rule above matches directly.
				}
			}
		};
	}
});
```

- [ ] **Step 6: Run full check and commit**

Run: `pnpm check && pnpm vitest run src/lib/components/tiptap/note-link-markdown.test.ts`
Expected: 0 type errors, 6 tests pass

```bash
git add src/lib/components/tiptap/NoteLink.ts src/lib/components/tiptap/note-link-markdown.ts src/lib/components/tiptap/note-link-markdown.test.ts
git commit -m "feat: add NoteLink tiptap node with markdown parse/serialize"
```

---

### Task 6: `NodeView`, title index, and `TiptapEditor.svelte` wiring

**Files:**
- Modify: `src/lib/components/tiptap/NoteLink.ts`
- Modify: `src/lib/components/TiptapEditor.svelte`

**Interfaces:**
- Consumes: `NoteLink` node (Task 5); `getAllNotes` from `src/lib/sync/idb.ts` (existing, `Promise<Note[]>`)
- Produces: `TiptapEditor.svelte` gains a new prop `onOpenNote?: (noteId: string) => void`

No dedicated unit test here — this step is pure DOM/interactivity wiring, verified in Task 11's e2e suite (consistent with how every other interactive editor behavior in this codebase is tested).

- [ ] **Step 1: Add the `NodeView` to `NoteLink.ts`**

Add `addNodeView()` to the `Node.create({...})` config from Task 5 (after `addStorage`):

```typescript
	addNodeView() {
		return ({ node, editor, getPos }) => {
			const noteId = node.attrs.noteId as string;
			const title = this.options.titleIndex.get(noteId);

			const dom = document.createElement('span');
			dom.className =
				'group relative inline-flex items-center gap-1 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-sm';

			const label = document.createElement('span');
			if (title !== undefined) {
				label.textContent = title;
				label.className = 'cursor-pointer text-[var(--primary)] hover:text-[var(--primary-hover)]';
				label.addEventListener('click', (event) => {
					event.preventDefault();
					this.options.onOpenNote(noteId);
				});
			} else {
				label.textContent = 'Note not found';
				label.className = 'text-[var(--text-muted)] opacity-60';
			}
			dom.appendChild(label);

			const removeButton = document.createElement('button');
			removeButton.type = 'button';
			removeButton.textContent = '×';
			removeButton.setAttribute('aria-label', 'Remove note link');
			removeButton.className =
				'max-md:opacity-100 md:opacity-0 transition-opacity md:group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--destructive)]';
			removeButton.addEventListener('click', (event) => {
				event.preventDefault();
				const pos = getPos();
				if (pos === undefined) return; // node was already removed from the doc
				editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
			});
			dom.appendChild(removeButton);

			return { dom };
		};
	}
```

- [ ] **Step 2: Build the synchronous title index and register the extension in `TiptapEditor.svelte`**

In `src/lib/components/TiptapEditor.svelte`, add imports:

```typescript
	import { NoteLink } from './tiptap/NoteLink.js';
	import { getAllNotes } from '$lib/sync/idb.js';
```

Add `onOpenNote` to the `Props` interface and destructure it:

```typescript
	interface Props {
		content: string;
		onUpdate: (markdown: string) => void;
		onEditor?: (editor: Editor) => void;
		onTransaction?: () => void;
		onOpenNote?: (noteId: string) => void;
		placeholder?: string;
	}

	let { content, onUpdate, onEditor, onTransaction, onOpenNote, placeholder = 'Add a crumb...' }: Props = $props();
```

Replace the existing `onMount(() => { editor = new Editor({...}); ... return () => { editor?.destroy(); }; });` block with:

```typescript
	onMount(() => {
		let destroyed = false;
		let editorInstance: Editor | undefined;

		(async () => {
			// Build a synchronous title index before constructing the editor: the
			// markdown serializer can't await IndexedDB mid-serialize, and the
			// NodeView needs titles ready for its very first render.
			const allNotes = await getAllNotes();
			if (destroyed) return;
			// Trashed notes are still present in IndexedDB for their owner (the sync
			// endpoint only excludes trashed notes from what's sent to *collaborators*,
			// not from what an owner's own device stores) — exclude them here so a
			// trashed note's links correctly render inert rather than "found".
			const titleIndex = new Map(allNotes.filter((n) => !n.trashed).map((n) => [n.id, n.title]));

			editorInstance = new Editor({
				element: element!,
				extensions: [
					StarterKit,
					Link.configure({ openOnClick: false }),
					Underline,
					TextAlign.configure({ types: ['heading', 'paragraph'] }),
					Placeholder.configure({ placeholder }),
					Table.configure({ resizable: false }),
					TableRow,
					TableHeader,
					TableCell,
					TaskList,
					TaskItem.configure({ nested: true }),
					NoteLink.configure({ titleIndex, onOpenNote: onOpenNote ?? (() => {}) }),
					Markdown
				],
				content,
				onUpdate: ({ editor: e }) => {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					onUpdate((e.storage as Record<string, any>).markdown.getMarkdown());
				},
				onTransaction: () => {
					editor = editor;
					onTransaction?.();
				}
			});
			editor = editorInstance;

			if (element) {
				(element as any).__tiptapEditor = editorInstance;
			}

			onEditor?.(editorInstance);
		})();

		return () => {
			destroyed = true;
			editorInstance?.destroy();
		};
	});
```

- [ ] **Step 3: Run full check**

Run: `pnpm check`
Expected: 0 type errors

- [ ] **Step 4: Manually smoke-test in the dev server**

Run: `pnpm dev`, open the app, create a note, confirm the editor still loads and typing/formatting still works (this step catches any gross regression from the onMount rewrite before it's buried under later tasks). No note-links exist yet to click — that's covered starting Task 7.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/tiptap/NoteLink.ts src/lib/components/TiptapEditor.svelte
git commit -m "feat: add NoteLink NodeView and wire title index into TiptapEditor"
```

---

### Task 7: Note-search UI in the FormattingToolbar link dropdown

**Files:**
- Modify: `src/lib/components/FormattingToolbar.svelte`

**Interfaces:**
- Consumes: `/api/search` (existing endpoint, returns `Note[]`); `NoteLink` node (Task 5/6, inserted via `editor.chain().insertContent(...)`)
- Produces: picking a search result inserts a `noteLink` node at the cursor

No dedicated unit test — this is UI interaction wiring, verified in Task 11's e2e suite (matching how the rest of `FormattingToolbar.svelte`'s interactive behavior is already tested via `formatting.spec.ts`, not unit tests).

- [ ] **Step 1: Add search state and a debounced fetch**

In `src/lib/components/FormattingToolbar.svelte`, add a `currentNoteId` prop (so the picker can exclude the currently-open note) and search state:

```typescript
	interface Props {
		tick?: number;
		editor: Editor | undefined;
		currentNoteId?: string | null;
	}

	let { editor, tick, currentNoteId = null }: Props = $props();
```

Add near the other `$state` declarations:

```typescript
	let noteSearchResults: { id: string; title: string }[] = $state([]);
	let noteSearchTimer: ReturnType<typeof setTimeout> | undefined;

	async function searchNotesForLink(query: string) {
		const requestId = ++noteSearchRequestId;
		if (!query.trim()) {
			noteSearchResults = [];
			return;
		}
		const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
		if (requestId !== noteSearchRequestId) return; // a newer search superseded this one
		if (!res.ok) return;
		const results: { id: string; title: string }[] = await res.json();
		noteSearchResults = results.filter((n) => n.id !== currentNoteId);
	}

	let noteSearchRequestId = 0;

	function handleLinkInput() {
		clearTimeout(noteSearchTimer);
		noteSearchTimer = setTimeout(() => searchNotesForLink(linkUrl), 200);
	}

	function insertNoteLink(noteId: string) {
		if (!editor) return;
		editor.chain().focus().insertContent({ type: 'noteLink', attrs: { noteId } }).run();
		noteSearchResults = [];
		closeDropdowns();
	}
```

- [ ] **Step 2: Wire the input's `oninput` handler and render results**

In the `{:else if openDropdown === 'link'}` block, add `oninput={handleLinkInput}` to the existing `<input bind:this={linkInput} ...>` element, and add a results list right after the closing `</form>` tag (still inside the same dropdown `<div>`):

```svelte
				<input
					bind:this={linkInput}
					bind:value={linkUrl}
					oninput={handleLinkInput}
					type="url"
					placeholder="Paste a link..."
					class="w-44 bg-transparent px-1.5 py-1 text-base md:text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
					data-testid="format-link-input"
				/>
```

```svelte
			{#if noteSearchResults.length > 0}
				<div class="mt-1 max-h-40 overflow-y-auto border-t border-[var(--border-subtle)] pt-1">
					{#each noteSearchResults as result (result.id)}
						<button
							type="button"
							onmousedown={preventToolbarMouseFocus}
							onclick={() => insertNoteLink(result.id)}
							class="block w-full truncate rounded-sm px-1.5 py-1 text-left text-sm text-[var(--text)] hover:bg-[var(--hover-wash)]/10"
							data-testid="format-link-note-result"
						>
							{result.title || 'Untitled'}
						</button>
					{/each}
				</div>
			{/if}
```

- [ ] **Step 3: Clear search state when the dropdown closes**

Find `closeDropdowns` (referenced by the existing Remove/Apply handlers) and add `noteSearchResults = [];` inside it, so stale results don't flash the next time the dropdown opens.

- [ ] **Step 4: Run full check**

Run: `pnpm check`
Expected: 0 type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/FormattingToolbar.svelte
git commit -m "feat: add note-search to the link toolbar dropdown"
```

---

### Task 8: Wire click-to-navigate through `NoteEditor` and `NotesView`

**Files:**
- Modify: `src/lib/components/NoteEditor.svelte`
- Modify: `src/lib/components/NotesView.svelte`

**Interfaces:**
- Consumes: `getNote` from `src/lib/sync/idb.ts` (existing, `Promise<Note | undefined>`); `openEditor(note: Note)` (existing, internal to `NotesView.svelte`)
- Produces: `NoteEditor` gains a required prop `onOpenNote: (noteId: string) => void`, threaded down to `TiptapEditor`'s `onOpenNote` prop from Task 6

- [ ] **Step 1: Thread `onOpenNote` through `NoteEditor.svelte`**

Add to the `Props` interface:

```typescript
	interface Props {
		note: Note | null;
		isNew?: boolean;
		initialChecklistMode?: boolean;
		onClose: () => void;
		onOpenNote: (noteId: string) => void;
	}

	const { note, isNew = false, initialChecklistMode = false, onClose, onOpenNote }: Props = $props();
```

Find the existing `<TiptapEditor {content} onUpdate={...} onEditor={...} onTransaction={...} placeholder="Add a crumb..." />` call and add `{onOpenNote}` to it.

- [ ] **Step 2: Implement the callback in `NotesView.svelte`**

Add the import:

```typescript
	import { getNote as getIdbNote } from '$lib/sync/idb.js';
```

Add a handler function near `openEditor`/`closeEditor`:

```typescript
	async function openNoteById(noteId: string) {
		const note = await getIdbNote(noteId);
		if (note) openEditor(note);
	}
```

Update both `<NoteEditor>` render sites to pass `onOpenNote={openNoteById}`:

```svelte
	<NoteEditor note={null} isNew={true} initialChecklistMode={newNoteChecklist} onClose={closeEditor} onOpenNote={openNoteById} />
```

```svelte
{#if editingNote}
	<NoteEditor note={editingNote} onClose={closeEditor} onOpenNote={openNoteById} />
```

- [ ] **Step 3: Run full check**

Run: `pnpm check`
Expected: 0 type errors (this will surface any other `<NoteEditor>` usage sites missing the now-required `onOpenNote` prop — there should be none besides the two above, per the earlier codebase search, but the compiler is the authority here)

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/NoteEditor.svelte src/lib/components/NotesView.svelte
git commit -m "feat: wire note-link click-to-navigate through NoteEditor and NotesView"
```

---

### Task 9: "Referenced by" backlinks section in `NoteEditor`

**Files:**
- Modify: `src/lib/components/NoteEditor.svelte`

**Interfaces:**
- Consumes: `note.backlinks` (`NoteBacklink[]`, from Task 4); `onOpenNote` (Task 8)

No dedicated unit test — pure presentational UI, verified in Task 11's e2e suite.

- [ ] **Step 1: Add the backlinks section**

Place this right after the existing "Image attachments" block (the `{#if noteId && (showImageUpload || attachmentsList.length > 0)}` section) and before the "Formatting toolbar" comment, in `src/lib/components/NoteEditor.svelte`:

```svelte
	{#if note?.backlinks && note.backlinks.length > 0}
		<div class="border-t border-[var(--border-subtle)] px-4 py-2 shrink-0">
			<p class="mb-1 text-xs font-medium text-[var(--text-muted)]">Referenced by</p>
			<div class="flex flex-wrap gap-1.5">
				{#each note.backlinks as backlink (backlink.id)}
					<button
						type="button"
						onclick={() => onOpenNote(backlink.id)}
						class="rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 text-xs text-[var(--text)] hover:border-[var(--primary)]"
						data-testid="backlink-chip"
					>
						{backlink.title || 'Untitled'}
					</button>
				{/each}
			</div>
		</div>
	{/if}
```

- [ ] **Step 2: Run full check**

Run: `pnpm check`
Expected: 0 type errors

- [ ] **Step 3: Manually smoke-test**

Run: `pnpm dev`. Create note A, link it to note B via the toolbar (Task 7's UI), save, reopen note B — confirm a "Referenced by" section appears showing note A, and clicking it opens note A.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/NoteEditor.svelte
git commit -m "feat: show a Referenced by backlinks section in the note editor"
```

---

### Task 10: Strip note-links to plain text in preview/public rendering

**Files:**
- Modify: `src/lib/utils/markdown.ts`
- Test: `src/lib/utils/markdown.test.ts` (existing file — add a new `describe` block)

**Interfaces:**
- Consumes: nothing new
- Produces: `renderMarkdown()` now renders `crumb-note://` links as plain text instead of a clickable anchor

`renderMarkdown()` is used only by `NoteCard.svelte` (grid preview) and the public share page (`src/routes/(share)/s/[token]/+page.svelte`) — both are read-only, non-interactive rendering contexts. Making this universal (rather than a public-page-only special case) is simpler and also fixes a case the spec didn't explicitly call out: without this, a note-link in a `NoteCard` preview would render as a real, dead `crumb-note://` anchor that does nothing when clicked and visually looks like a normal link.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/utils/markdown.test.ts`:

```typescript
describe('renderMarkdown note-link handling', () => {
	it('should render a crumb-note:// link as plain text, not a clickable anchor', () => {
		const html = renderMarkdown('See [Grocery List](crumb-note://abc-123) for details');
		expect(html).not.toContain('<a');
		expect(html).toContain('Grocery List');
	});

	it('should still render a normal external link as a real anchor', () => {
		const html = renderMarkdown('See [Example](https://example.com) for details');
		expect(html).toContain('<a href="https://example.com"');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/utils/markdown.test.ts`
Expected: FAIL — the crumb-note:// link currently renders as `<a href="crumb-note://abc-123">Grocery List</a>`

- [ ] **Step 3: Add a markdown-it rule stripping note-links to plain text**

In `src/lib/utils/markdown.ts`, add after the existing task-list rule registration (`md.core.ruler.after('inline', 'task-lists', ...)`):

```typescript
// Note-links (crumb-note://<id>) are only ever rendered in read-only preview
// contexts (NoteCard grid preview, public share page) — never resolve them
// to a clickable anchor there; the live tiptap NoteLink node handles the
// interactive, authenticated-editor case separately.
md.core.ruler.after('task-lists', 'note-links', (state) => {
	for (const token of state.tokens) {
		if (token.type !== 'inline' || !token.children) continue;

		const children = token.children;
		for (let i = 0; i < children.length; i++) {
			if (children[i].type !== 'link_open') continue;
			const href = children[i].attrGet('href') ?? '';
			if (!href.startsWith('crumb-note://')) continue;

			// Find the matching link_close and drop the open/close tokens,
			// leaving just the inner text content in place.
			let closeIndex = i + 1;
			while (closeIndex < children.length && children[closeIndex].type !== 'link_close') closeIndex++;
			children.splice(closeIndex, 1);
			children.splice(i, 1);
			i -= 1;
		}
	}
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/utils/markdown.test.ts`
Expected: PASS (all existing tests plus the 2 new ones)

- [ ] **Step 5: Run full check and commit**

Run: `pnpm check`
Expected: 0 type errors

```bash
git add src/lib/utils/markdown.ts src/lib/utils/markdown.test.ts
git commit -m "feat: render note-links as plain text in preview and public contexts"
```

---

### Task 11: End-to-end test suite

**Files:**
- Create: `tests/e2e/note-linking.spec.ts`

**Interfaces:**
- Consumes: `authenticatedPage` fixture, `createNote` helper (`tests/e2e/helpers/fixtures.ts`, existing)

- [ ] **Step 1: Write the scenarios**

```typescript
// tests/e2e/note-linking.spec.ts
import { test, expect, createNote } from './helpers/fixtures.js';

test.describe('Note Linking', () => {
	test('Scenario: Linking to a note renders a live chip and clicking it opens that note', async ({ authenticatedPage: page }) => {
		// Given two notes exist
		await createNote(page, 'Target Note', 'target content');
		await createNote(page, 'Source Note', 'source content');

		// When the user opens the link toolbar and picks the target note
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Linker Note');
		const editor = page.getByTestId('tiptap-editor').locator('.tiptap');
		await editor.click();
		await page.getByTestId('format-link').click();
		await page.getByTestId('format-link-input').fill('Target');
		await page.getByTestId('format-link-note-result').filter({ hasText: 'Target Note' }).click();

		// Then a live chip for the target note appears in the editor
		await expect(editor.getByText('Target Note')).toBeVisible();

		// When the user clicks the chip
		await editor.getByText('Target Note').click();

		// Then the target note opens in the editor
		await expect(page.getByTestId('note-title-input')).toHaveValue('Target Note');
	});

	test('Scenario: Renaming a linked note updates the displayed link text', async ({ authenticatedPage: page }) => {
		// Given a note links to another note
		await createNote(page, 'Original Title', '');
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Linker Note');
		const editor = page.getByTestId('tiptap-editor').locator('.tiptap');
		await editor.click();
		await page.getByTestId('format-link').click();
		await page.getByTestId('format-link-input').fill('Original');
		await page.getByTestId('format-link-note-result').filter({ hasText: 'Original Title' }).click();
		await page.getByTestId('close-editor-btn').click();

		// When the linked note is renamed
		await page.getByText('Original Title').click();
		await page.getByTestId('note-title-input').fill('Renamed Title');
		await page.getByTestId('close-editor-btn').click();

		// Then reopening the linking note shows the new title on the chip
		await page.getByText('Linker Note').click();
		await expect(editor.getByText('Renamed Title')).toBeVisible();
		await expect(editor.getByText('Original Title')).not.toBeVisible();
	});

	test('Scenario: A link to a trashed note renders inert and does not navigate', async ({ authenticatedPage: page }) => {
		// Given a note links to another note
		await createNote(page, 'Doomed Note', '');
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Linker Note');
		const editor = page.getByTestId('tiptap-editor').locator('.tiptap');
		await editor.click();
		await page.getByTestId('format-link').click();
		await page.getByTestId('format-link-input').fill('Doomed');
		await page.getByTestId('format-link-note-result').filter({ hasText: 'Doomed Note' }).click();
		await page.getByTestId('close-editor-btn').click();

		// When the linked note is trashed (not yet permanently deleted)
		await page.getByText('Doomed Note').click();
		await page.getByTestId('trash-note-btn').click();
		await page.getByTestId('close-editor-btn').click();

		// Then reopening the linking note shows the link as inert and it does not navigate
		await page.getByText('Linker Note').click();
		await expect(editor.getByText('Note not found')).toBeVisible();
		await editor.getByText('Note not found').click();
		await expect(page.getByTestId('note-title-input')).toHaveValue('Linker Note');
		await page.getByTestId('close-editor-btn').click();

		// When the note is permanently deleted from the trash
		await page.goto('/trash');
		await page.getByText('Doomed Note').click();
		await page.getByTestId('delete-forever-btn').click();
		await page.goto('/');

		// Then the link is still inert (nothing changes — it was already inert while trashed)
		await page.getByText('Linker Note').click();
		await expect(editor.getByText('Note not found')).toBeVisible();
	});

	test('Scenario: The linked-to note shows a Referenced by backlink', async ({ authenticatedPage: page }) => {
		// Given a note links to another note
		await createNote(page, 'Popular Note', '');
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Referencing Note');
		const editor = page.getByTestId('tiptap-editor').locator('.tiptap');
		await editor.click();
		await page.getByTestId('format-link').click();
		await page.getByTestId('format-link-input').fill('Popular');
		await page.getByTestId('format-link-note-result').filter({ hasText: 'Popular Note' }).click();
		await page.getByTestId('close-editor-btn').click();

		// When the linked-to note is opened
		await page.getByText('Popular Note').click();

		// Then it shows a Referenced by section pointing back at the referencing note
		await expect(page.getByTestId('backlink-chip').filter({ hasText: 'Referencing Note' })).toBeVisible();
	});

	test('Scenario: The note-picker excludes the currently-open note from its own search results', async ({ authenticatedPage: page }) => {
		// Given the current note's title matches its own search query
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Self Reference Test');
		const editor = page.getByTestId('tiptap-editor').locator('.tiptap');
		await editor.click();

		// When the user searches the link picker for the current note's own title
		await page.getByTestId('format-link').click();
		await page.getByTestId('format-link-input').fill('Self Reference');

		// Then it does not appear among the results
		await expect(page.getByTestId('format-link-note-result').filter({ hasText: 'Self Reference Test' })).toHaveCount(0);
	});

	test('Scenario: Hovering a note-link chip reveals a remove button that deletes it without navigating', async ({ authenticatedPage: page }) => {
		// Given a note links to another note
		await createNote(page, 'Removable Target', '');
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Has A Link');
		const editor = page.getByTestId('tiptap-editor').locator('.tiptap');
		await editor.click();
		await page.getByTestId('format-link').click();
		await page.getByTestId('format-link-input').fill('Removable');
		await page.getByTestId('format-link-note-result').filter({ hasText: 'Removable Target' }).click();

		// When the user removes the link via its hover button
		await editor.getByText('Removable Target').hover();
		await page.getByRole('button', { name: 'Remove note link' }).click();

		// Then the chip is gone and the current note is still open (no navigation happened)
		await expect(editor.getByText('Removable Target')).toHaveCount(0);
		await expect(page.getByTestId('note-title-input')).toHaveValue('Has A Link');
	});
});
```

- [ ] **Step 2: Build and run the new spec**

Run: `pnpm build && npx playwright test tests/e2e/note-linking.spec.ts`
Expected: all 6 scenarios pass. If any fail, use `--reporter=list` and re-run in isolation (`-g "<scenario name>"`) to debug — do not proceed to Step 3 with failing tests.

- [ ] **Step 3: Run the full test suite**

Run: `pnpm test`
Expected: all unit tests and all e2e tests (existing + new) pass — this catches any regression the `TiptapEditor.svelte` onMount rewrite (Task 6) or the FormattingToolbar changes (Task 7) may have introduced elsewhere.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/note-linking.spec.ts
git commit -m "test: add e2e coverage for note linking"
```

---

## Post-Plan Checklist

- [ ] Update `docs/FEATURES.md` with a short note-linking entry, matching the style of other feature entries (e.g. the existing "Public link sharing" section)
- [ ] Update `docs/ARCHITECTURE.md`'s schema section to list the new `note_links` table alongside the existing table list
- [ ] Comment on GitHub issue #74 summarizing what shipped, once this plan is fully executed
