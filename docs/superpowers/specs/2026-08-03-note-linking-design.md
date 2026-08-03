# Note Linking — Design Spec

**Issue**: [#74 — feat: link to other crumbs (notes) inside the app](https://github.com/bretzel-app/crumbs/issues/74)
**Date**: 2026-08-03

## Overview

Let a note reference another note by ID, so clicking it opens the target note in the editor. Reuses the existing "insert link" toolbar entry point (Ctrl+K) rather than introducing a new `[[wikilink]]`-style typing syntax. The displayed link text always tracks the target note's current title — it's a live reference, not frozen text — and the target note gets a "Referenced by" backlinks section.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Link creation UX | Extend the existing link toolbar dropdown with a note-search mode | Matches the issue reporter's own proposed solution; reuses the Link dropdown, `/api/search`, and toolbar infra as-is instead of building a new inline autocomplete |
| Click behavior | Opens the target note in the editor overlay, same as clicking a note card | Matches how every other note-opening interaction already works in the app |
| Link label | Always the target note's live title | A stale link label after a rename would be confusing; this requires modeling the link as an atomic node rather than a mark (see Architecture) |
| Broken/inaccessible links | Grey out, inert, content untouched | Nothing is silently rewritten; if the note is restored from trash the link works again automatically |
| Backlinks | Included in v1 | Requested explicitly; reuses the same extract-and-sync pattern tags already use, so the incremental cost is a reverse query, not new infrastructure |
| Public share page | Note-links never resolve, even if the target is also shared | Simplest, most conservative option — zero chance of leaking the existence of a private note to an anonymous visitor |
| Link picker scope | Owned notes + notes shared with you | Same visibility scope the main notes list already uses; `searchNotes()` already implements this |

## Architecture

**Data model** — a new self-referential join table, mirroring `noteTags`/`tags`:

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

**Markdown representation** — a note-link round-trips through raw markdown as a normal-looking link with a custom URI scheme:

```
[Grocery List](crumb-note://<note-id>)
```

This keeps the existing raw-markdown-mode toggle showing something readable, and keeps exported/copied content sensible outside the app. The title baked into the markdown text is only ever a fallback for external tools — inside the app, parsing recognizes the `crumb-note://` scheme and rebuilds the live node, discarding whatever static text was there.

**Editor node** — a new tiptap **node** (not a mark) named `NoteLink`, with a single attribute `{ noteId: string }`. Unlike a mark, a node fully owns its own rendering, which is what makes "always show the live title" possible — a mark decorates existing typed text and has no clean way to swap that text later.

## Components

### Client

| Component | Change |
|---|---|
| `src/lib/components/tiptap/NoteLink.ts` (new) | Inline atomic tiptap node extension. `NodeView` looks up the target's title via `getNote(id)` from `src/lib/sync/idb.ts` — **not** the reactive `notes` writable store, which only holds whatever the current filter (all/archived/trashed) last loaded and would wrongly grey out a valid note just because it's outside the current view. IndexedDB is kept complete for all accessible notes by the existing `/api/sync` incremental sync, independent of which filter is on screen, so it's the correct source of truth here — and it works offline too. Renders a chip (note icon + title), greys out and disables click if the note isn't found. Click opens the note editor overlay for that ID. |
| `src/lib/components/TiptapEditor.svelte` | Register the `NoteLink` node extension alongside the existing ones. |
| `src/lib/components/FormattingToolbar.svelte` | The existing link dropdown gets a note-search results list below the URL input, live-filtered by whatever's typed there (debounced, via `/api/search`, excluding the currently-open note) — no heuristic needed to guess whether the typed text is a URL or a note search; both affordances are just available side by side. Applying the URL input still applies the normal external `Link` mark; picking a search result instead inserts a `NoteLink` node at the cursor (replacing any selection). |
| `src/lib/components/NoteEditor.svelte` | New "Referenced by" section, shown when `note.backlinks` is non-empty — a small chip list near where tags render, each chip opens that referencing note. |

### Server

| Function | Location | Description |
|---|---|---|
| `extractNoteLinks(content): string[]` | `src/lib/utils/note-links.ts` (new) | Regex-extracts `crumb-note://<id>` references from markdown content, same code-block/URL exclusions `extractTags` already applies. |
| `syncNoteLinks(db, noteId, targetIds, userId)` | `src/lib/server/note-links.ts` (new) | Mirrors `syncNoteTags`: clears existing rows for the note, re-inserts the current set, within the same save transaction. |
| `fetchBacklinksForNote(db, noteId, userId)` | `src/lib/server/note-links.ts` (new) | Reverse query on `noteLinks.targetNoteId`, joined through the same access rules as everything else (owner or collaborator on the *source* note), returning `{id, title}` pairs. |

`getNote()` in `notes-service.ts` calls `fetchBacklinksForNote` and attaches the result as `backlinks`. This is **not** added to `hydrateNotes()` (which also backs list views) — computing backlinks for every note in a list load would be wasted work for something only the open editor displays.

## Data Flow

1. **Create** — pick a note in the toolbar's link dropdown → a `NoteLink` node is inserted at the cursor.
2. **Save** — content round-trips to markdown as usual; the note-save transaction additionally runs `extractNoteLinks` + `syncNoteLinks`, alongside the existing tag sync.
3. **Reopen** — markdown parses back into the doc; a custom parse rule recognizes `crumb-note://` and produces a `NoteLink` node; its `NodeView` looks up the live title via IndexedDB (`getNote(id)`), not the filter-scoped reactive store (see Components).
4. **Click** — opens the target note in the editor overlay.
5. **Rename** — no action needed anywhere: the title is looked up live at render time, so the next render already shows the new title.
6. **Trash / permanent delete / no access** — all three are treated identically: the note simply isn't found in IndexedDB (or, server-side, fails the backlink query's access check), so the link renders inert. The referencing note's content is never rewritten.
7. **Public share page** — doesn't use the tiptap editor; content is rendered server-side via `markdown-it`. That render path strips `crumb-note://` links down to plain, non-clickable text, regardless of whether the target is also shared.

## Error Handling

- **Malformed `crumb-note://` reference** during markdown parse falls back to plain text rather than crashing the parse.
- **Search race conditions** in the toolbar's note-picker are debounced and guarded against stale results overwriting newer ones, same pattern the existing search feature (`tests/e2e/search.spec.ts`) already covers.
- **Self-links** — the currently-open note is filtered out of its own picker results.
- **Circular references** (A ↔ B) are a non-issue — clicking only ever opens one note at a time, nothing recurses.
- **Cross-user link privacy** — the picker only offers notes you can already access, so under normal use a link can only point at something you had legitimate access to when you created it. Hand-editing raw markdown with a guessed note ID is the only way around that, and note IDs are unguessable UUIDs — the same "if you have the ID, you were meant to have it" trust model the app already applies to session/share tokens. Accepted as a low-severity edge case rather than adding extra access-control plumbing for it.

## Testing

**Unit (Vitest)**
- `extractNoteLinks` — extracts IDs, ignores code blocks/URLs, dedupes, handles empty content
- `syncNoteLinks` — clears + re-inserts correctly
- `fetchBacklinksForNote` — returns only notes the requesting user can access
- Markdown round-trip — a `NoteLink` node serializes to `[title](crumb-note://id)` and parses back to the same node with the right `noteId`

**E2E (Playwright)**
- Linking to a note from the toolbar renders a live chip; clicking it opens that note
- Renaming the linked note updates the displayed link text next time it's viewed
- A link to a trashed/deleted/inaccessible note renders inert and doesn't navigate
- The linked-to note shows a "Referenced by" backlink to the note that links to it
- A public share page never renders a note-link as clickable, even if the target is also shared
- The note-picker excludes the currently-open note from its own search results

## Out of Scope (v1)

- Inline `[[wikilink]]`/`@mention` autocomplete while typing (toolbar-only for now; can be added later without touching the data model)
- Note graph / visual map view
- Ranking or sorting backlinks beyond simple list order
- Cross-user access-control tightening for hand-crafted `crumb-note://` references (see Error Handling)

## Acceptance Criteria

- [ ] Link toolbar dropdown supports searching and picking another note, in addition to pasting a URL
- [ ] Picking a note inserts a live `NoteLink` node showing the target's current title
- [ ] Clicking a note-link opens the target note in the editor overlay
- [ ] Renaming a note updates its link's displayed text everywhere, without editing referencing notes' content
- [ ] Trashed, deleted, or inaccessible link targets render greyed-out and inert
- [ ] Note editor shows a "Referenced by" section listing notes that link to it
- [ ] Public share page never renders a note-link as clickable
- [ ] Note-links round-trip correctly through raw markdown mode as `[title](crumb-note://id)`
- [ ] The link picker excludes the current note and includes both owned and shared-with-you notes
