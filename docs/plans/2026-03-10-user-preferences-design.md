# User Preferences

## Overview

Add user-customizable preferences to Crumbs: default note mode, default note color, hide footer, and sidebar default state. Preferences are stored client-side (localStorage) for offline-first access and synced to the server for cross-device consistency.

## Preferences (v1)

| Key | Type | Default | Description |
|---|---|---|---|
| `defaultNoteMode` | `"richtext" \| "markdown"` | `"richtext"` | Editor mode for new notes |
| `defaultNoteColor` | `NoteColor` | `"default"` | Color for new notes |
| `hideFooter` | `boolean` | `false` | Hide the footer branding |
| `sidebarDefaultState` | `"open" \| "collapsed"` | `"open"` | Sidebar state on page load |

## Server

- **New table**: `user_preferences(id, userId, key, value, updatedAt)` with unique constraint on `(userId, key)`
- **API**: `GET /api/preferences` (returns all prefs for user), `PUT /api/preferences` (upserts a batch of key-value pairs)
- Included in sync pull/push alongside notes

## Client

- **New store**: `src/lib/stores/preferences.ts` — `$state` runes backed by localStorage
- On load: read from localStorage immediately (offline-first), then hydrate from server when online
- On change: write to localStorage + debounced PUT to server
- Sync conflict resolution: last-write-wins per key using `updatedAt`

## Settings UI

- New **Preferences** tab (first in tab order, `SlidersHorizontal` icon)
- Tab order: Preferences > Profile > API > Users
- Toggle switches for booleans (hideFooter, sidebarDefaultState)
- Segmented button or select for defaultNoteMode
- Color picker (reuse existing note color palette) for defaultNoteColor

## Integration points

- **NoteEditor**: read `defaultNoteMode` to set initial `rawMarkdownMode` for new notes
- **NoteEditor**: read `defaultNoteColor` to set initial `color` for new notes
- **App layout**: read `hideFooter` to conditionally render footer
- **Sidebar**: read `sidebarDefaultState` to set initial open/closed state
