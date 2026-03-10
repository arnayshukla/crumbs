# User Preferences Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add user-customizable preferences (default note mode, default note color, hide footer, sidebar default state) with offline-first localStorage + server sync.

**Architecture:** Key-value `user_preferences` table on the server, synced via dedicated API endpoints. Client reads from localStorage immediately (offline-first), hydrates from server when online, and pushes changes on update. Preferences exposed via a Svelte `$state` runes store.

**Tech Stack:** SvelteKit, Svelte 5 runes, Drizzle ORM (SQLite), localStorage, Vitest, Playwright

---

### Task 1: Database Schema — `userPreferences` table

**Files:**
- Modify: `src/lib/server/db/schema.ts` (add table after `loginAttempts`, ~line 177)
- Modify: `src/lib/server/db/test-helpers.ts` (add CREATE TABLE to test schema)

**Step 1: Add the Drizzle table definition**

In `src/lib/server/db/schema.ts`, add after `loginAttempts`:

```typescript
export const userPreferences = sqliteTable(
	'user_preferences',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: integer('user_id')
			.references(() => users.id)
			.notNull(),
		key: text('key').notNull(),
		value: text('value').notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [
		uniqueIndex('user_preferences_user_key_unique').on(table.userId, table.key),
		index('user_preferences_user_id_idx').on(table.userId)
	]
);
```

**Step 2: Add the table to test-helpers.ts**

In `src/lib/server/db/test-helpers.ts`, add inside the `sqlite.exec` block before the closing backtick:

```sql
CREATE TABLE user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX user_preferences_user_key_unique ON user_preferences(user_id, key);
CREATE INDEX user_preferences_user_id_idx ON user_preferences(user_id);
```

**Step 3: Generate migration**

Run: `make db-generate`

**Step 4: Push schema to dev DB**

Run: `make db-push`

**Step 5: Verify existing tests still pass**

Run: `make test-unit`

**Step 6: Commit**

```
feat: add userPreferences table schema
```

---

### Task 2: Preferences Types & Defaults

**Files:**
- Create: `src/lib/types/preferences.ts`
- Modify: `src/lib/types/index.ts` (re-export)

**Step 1: Create the preferences type file**

Create `src/lib/types/preferences.ts`:

```typescript
import type { NoteColor } from './index.js';

export interface UserPreferences {
	defaultNoteMode: 'richtext' | 'markdown';
	defaultNoteColor: NoteColor;
	hideFooter: boolean;
	sidebarDefaultState: 'open' | 'collapsed';
}

export const DEFAULT_PREFERENCES: UserPreferences = {
	defaultNoteMode: 'richtext',
	defaultNoteColor: 'default',
	hideFooter: false,
	sidebarDefaultState: 'open'
};

/** Keys that are boolean values (stored as "true"/"false" strings in DB) */
export const BOOLEAN_PREF_KEYS: (keyof UserPreferences)[] = ['hideFooter'];
```

**Step 2: Re-export from index**

In `src/lib/types/index.ts`, add:

```typescript
export type { UserPreferences } from './preferences.js';
export { DEFAULT_PREFERENCES } from './preferences.js';
```

**Step 3: Commit**

```
feat: add UserPreferences types and defaults
```

---

### Task 3: Server-side Preferences Service

**Files:**
- Create: `src/lib/server/preferences.ts`
- Test: `src/lib/server/preferences.test.ts`

**Step 1: Write the failing tests**

Create `src/lib/server/preferences.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './db/test-helpers.js';
import { users } from './db/schema.js';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from './db/schema.js';
import { getPreferences, upsertPreferences } from './preferences.js';

let db: BetterSQLite3Database<typeof schema>;
const USER_ID = 1;

beforeEach(() => {
	const testDb = createTestDb();
	db = testDb.db;
	db.insert(users).values({
		email: 'test@test.com',
		displayName: 'Test',
		role: 'user',
		authProvider: 'password',
		createdAt: new Date()
	}).run();
});

describe('getPreferences', () => {
	it('should return empty object when no preferences set', () => {
		const prefs = getPreferences(db, USER_ID);
		expect(prefs).toEqual({});
	});

	it('should return all preferences for user', () => {
		upsertPreferences(db, USER_ID, { defaultNoteMode: 'markdown' });
		const prefs = getPreferences(db, USER_ID);
		expect(prefs).toEqual({ defaultNoteMode: 'markdown' });
	});
});

describe('upsertPreferences', () => {
	it('should insert new preferences', () => {
		upsertPreferences(db, USER_ID, {
			defaultNoteMode: 'markdown',
			hideFooter: 'true'
		});
		const prefs = getPreferences(db, USER_ID);
		expect(prefs.defaultNoteMode).toBe('markdown');
		expect(prefs.hideFooter).toBe('true');
	});

	it('should update existing preferences', () => {
		upsertPreferences(db, USER_ID, { defaultNoteMode: 'markdown' });
		upsertPreferences(db, USER_ID, { defaultNoteMode: 'richtext' });
		const prefs = getPreferences(db, USER_ID);
		expect(prefs.defaultNoteMode).toBe('richtext');
	});

	it('should only update specified keys, leaving others unchanged', () => {
		upsertPreferences(db, USER_ID, { defaultNoteMode: 'markdown', hideFooter: 'true' });
		upsertPreferences(db, USER_ID, { defaultNoteMode: 'richtext' });
		const prefs = getPreferences(db, USER_ID);
		expect(prefs.defaultNoteMode).toBe('richtext');
		expect(prefs.hideFooter).toBe('true');
	});
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/server/preferences.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the service**

Create `src/lib/server/preferences.ts`:

```typescript
import { eq, and } from 'drizzle-orm';
import { userPreferences } from './db/schema.js';
import type { Db } from './db/index.js';

/**
 * Get all preferences for a user as a key-value record.
 */
export function getPreferences(db: Db, userId: number): Record<string, string> {
	const rows = db
		.select({ key: userPreferences.key, value: userPreferences.value })
		.from(userPreferences)
		.where(eq(userPreferences.userId, userId))
		.all();

	return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/**
 * Upsert preferences for a user. Only the provided keys are created/updated.
 */
export function upsertPreferences(
	db: Db,
	userId: number,
	prefs: Record<string, string>
): void {
	const now = new Date();
	for (const [key, value] of Object.entries(prefs)) {
		const existing = db
			.select({ id: userPreferences.id })
			.from(userPreferences)
			.where(and(eq(userPreferences.userId, userId), eq(userPreferences.key, key)))
			.get();

		if (existing) {
			db.update(userPreferences)
				.set({ value, updatedAt: now })
				.where(eq(userPreferences.id, existing.id))
				.run();
		} else {
			db.insert(userPreferences)
				.values({ userId, key, value, updatedAt: now })
				.run();
		}
	}
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/server/preferences.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat: add preferences server service with tests
```

---

### Task 4: Preferences API Endpoints

**Files:**
- Create: `src/routes/api/preferences/+server.ts`

**Step 1: Create the API endpoint**

Create `src/routes/api/preferences/+server.ts`:

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserId } from '$lib/server/api-utils.js';
import { getPreferences, upsertPreferences } from '$lib/server/preferences.js';
import { db } from '$lib/server/db/index.js';

export const GET: RequestHandler = async (event) => {
	const userId = getUserId(event);
	const prefs = getPreferences(db, userId);
	return json(prefs);
};

export const PUT: RequestHandler = async ({ request, ...event }) => {
	const userId = getUserId(event);
	const body: Record<string, string> = await request.json();

	// Validate: only accept string key-value pairs
	const cleaned: Record<string, string> = {};
	for (const [key, value] of Object.entries(body)) {
		if (typeof key === 'string' && typeof value === 'string') {
			cleaned[key] = value;
		}
	}

	upsertPreferences(db, userId, cleaned);
	const updated = getPreferences(db, userId);
	return json(updated);
};
```

**Step 2: Verify build passes**

Run: `make check`

**Step 3: Commit**

```
feat: add GET/PUT /api/preferences endpoints
```

---

### Task 5: Client-side Preferences Store

**Files:**
- Create: `src/lib/stores/preferences.ts`

**Step 1: Create the preferences store**

Create `src/lib/stores/preferences.ts`:

```typescript
import { browser } from '$app/environment';
import { DEFAULT_PREFERENCES, BOOLEAN_PREF_KEYS } from '$lib/types/preferences.js';
import type { UserPreferences } from '$lib/types/preferences.js';

const STORAGE_KEY = 'crumbs-preferences';

let preferences = $state<UserPreferences>({ ...DEFAULT_PREFERENCES });
let initialized = false;

/** Parse a server record into typed UserPreferences */
function parsePreferences(raw: Record<string, string>): Partial<UserPreferences> {
	const result: Partial<UserPreferences> = {};
	for (const [key, value] of Object.entries(raw)) {
		if (key in DEFAULT_PREFERENCES) {
			if (BOOLEAN_PREF_KEYS.includes(key as keyof UserPreferences)) {
				(result as Record<string, unknown>)[key] = value === 'true';
			} else {
				(result as Record<string, unknown>)[key] = value;
			}
		}
	}
	return result;
}

/** Serialize typed preferences to string record for the server */
function serializePreferences(prefs: Partial<UserPreferences>): Record<string, string> {
	const result: Record<string, string> = {};
	for (const [key, value] of Object.entries(prefs)) {
		result[key] = String(value);
	}
	return result;
}

/** Load from localStorage (instant, offline-first) */
function loadFromStorage(): void {
	if (!browser) return;
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			preferences = { ...DEFAULT_PREFERENCES, ...parsed };
		}
	} catch {
		// Corrupted storage — use defaults
	}
}

/** Save to localStorage */
function saveToStorage(): void {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
	} catch {
		// Storage full or unavailable
	}
}

/** Fetch from server and merge (server wins for sync) */
export async function syncPreferencesFromServer(): Promise<void> {
	try {
		const res = await fetch('/api/preferences');
		if (!res.ok) return;
		const raw: Record<string, string> = await res.json();
		const serverPrefs = parsePreferences(raw);
		if (Object.keys(serverPrefs).length > 0) {
			preferences = { ...DEFAULT_PREFERENCES, ...serverPrefs };
			saveToStorage();
		}
	} catch {
		// Offline — localStorage values are fine
	}
}

/** Push a preference change to the server */
async function pushToServer(updates: Partial<UserPreferences>): Promise<void> {
	try {
		await fetch('/api/preferences', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(serializePreferences(updates))
		});
	} catch {
		// Offline — will sync on next pull
	}
}

/** Initialize the store (call once on app mount) */
export function initPreferences(): void {
	if (initialized) return;
	initialized = true;
	loadFromStorage();
	syncPreferencesFromServer();
}

/** Get the reactive preferences object */
export function getPreferences(): UserPreferences {
	return preferences;
}

/** Update one or more preferences */
export function updatePreference<K extends keyof UserPreferences>(
	key: K,
	value: UserPreferences[K]
): void {
	preferences = { ...preferences, [key]: value };
	saveToStorage();
	pushToServer({ [key]: value } as Partial<UserPreferences>);
}

/** Reset preferences to defaults */
export function resetPreferences(): void {
	preferences = { ...DEFAULT_PREFERENCES };
	saveToStorage();
	pushToServer(DEFAULT_PREFERENCES);
}
```

**Step 2: Verify build passes**

Run: `make check`

**Step 3: Commit**

```
feat: add client-side preferences store with localStorage + server sync
```

---

### Task 6: Initialize Preferences in App Layout

**Files:**
- Modify: `src/routes/(app)/+layout.svelte`

**Step 1: Wire up preferences initialization and footer toggle**

In `src/routes/(app)/+layout.svelte`:

1. Add imports:
```typescript
import { initPreferences, getPreferences } from '$lib/stores/preferences.js';
```

2. In `onMount`, after `startSync()`, add:
```typescript
initPreferences();
```

3. Add a derived reference:
```typescript
let prefs = $derived(getPreferences());
```

4. Replace the sidebar initial state line:
```typescript
// Before:
sidebarOpen = window.matchMedia('(min-width: 1024px)').matches;
// After:
const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
sidebarOpen = isDesktop && getPreferences().sidebarDefaultState !== 'collapsed';
```

5. Wrap the footer conditionally:
```svelte
{#if !prefs.hideFooter}
<footer class="pb-4 pt-8 text-center text-xs text-[var(--text-muted)] {sidebarOpen ? 'lg:ml-64' : ''}">
    Crumbs by <a href="https://bretzel.app" target="_blank" rel="noopener noreferrer" class="hover:text-[var(--primary)] transition-colors">Bretzel</a> &mdash; made with 🥨 in Strasbourg
</footer>
{/if}
```

**Step 2: Verify build passes**

Run: `make check`

**Step 3: Commit**

```
feat: wire preferences into app layout (footer toggle, sidebar default)
```

---

### Task 7: Wire Default Note Mode & Color into NoteEditor

**Files:**
- Modify: `src/lib/components/NoteEditor.svelte` (~lines 35, 41)

**Step 1: Apply preferences for new notes**

In `src/lib/components/NoteEditor.svelte`:

1. Add import:
```typescript
import { getPreferences } from '$lib/stores/preferences.js';
```

2. Change the `color` default (line 35):
```typescript
// Before:
let color = $state<NoteColor>(note?.color ?? 'default');
// After:
let color = $state<NoteColor>(note?.color ?? getPreferences().defaultNoteColor);
```

3. Change the `rawMarkdownMode` default (line 41):
```typescript
// Before:
let rawMarkdownMode = $state(note?.checklistMode ?? false);
// After:
let rawMarkdownMode = $state(
    note ? (note.checklistMode ?? false) : getPreferences().defaultNoteMode === 'markdown'
);
```

Note: For existing notes, we keep the existing behavior. Only new notes (`note === null`) use the preference.

**Step 2: Verify build passes**

Run: `make check`

**Step 3: Commit**

```
feat: apply default note mode and color preferences to new notes
```

---

### Task 8: Settings UI — Preferences Tab

**Files:**
- Create: `src/routes/(app)/settings/preferences/+page.svelte`
- Modify: `src/routes/(app)/settings/+layout.svelte` (add tab, reorder)

**Step 1: Update the settings layout to add Preferences tab first**

In `src/routes/(app)/settings/+layout.svelte`:

1. Add import:
```typescript
import { SlidersHorizontal } from 'lucide-svelte';
```

2. Add `startsWith` check for active state:
```typescript
let isPreferencesActive = $derived(pathname === '/settings/preferences');
```

3. Insert new `<li>` as the first item in the `<ul>`:
```svelte
<li>
    <a
        href="/settings/preferences"
        class="flex items-center gap-2 rounded-sm px-3 py-2 text-sm whitespace-nowrap transition-colors {isPreferencesActive ? 'bg-[var(--primary)]/15 text-[var(--primary)] font-medium' : 'text-[var(--text)] hover:bg-[var(--bg-base)]'}"
    >
        <SlidersHorizontal size={16} />
        Preferences
    </a>
</li>
```

4. Update `/settings` route to redirect to `/settings/preferences` as the default tab (or keep Profile as the `/settings` route — depends on preference). Since Preferences is first, update the Profile link's active state to still use `pathname === '/settings'`.

**Step 2: Create the Preferences page**

Create `src/routes/(app)/settings/preferences/+page.svelte`:

```svelte
<script lang="ts">
    import ColorPicker from '$lib/components/ColorPicker.svelte';
    import { getPreferences, updatePreference } from '$lib/stores/preferences.js';
    import type { NoteColor } from '$lib/types/index.js';

    let prefs = $derived(getPreferences());
</script>

<div class="space-y-8">
    <div>
        <h2 class="text-lg font-semibold text-[var(--text)]">Preferences</h2>
        <p class="mt-1 text-sm text-[var(--text-muted)]">Customize your Crumbs experience</p>
    </div>

    <!-- Default note mode -->
    <div class="space-y-2">
        <label class="text-sm font-medium text-[var(--text)]">Default note mode</label>
        <p class="text-xs text-[var(--text-muted)]">Choose the editor mode for new notes</p>
        <div class="flex gap-2">
            <button
                onclick={() => updatePreference('defaultNoteMode', 'richtext')}
                class="rounded-sm border px-4 py-2 text-sm transition-colors {prefs.defaultNoteMode === 'richtext' ? 'border-[var(--primary)] bg-[var(--primary)]/15 text-[var(--primary)] font-medium' : 'border-[var(--border-subtle)] text-[var(--text)] hover:border-[var(--primary)]'}"
                data-testid="pref-mode-richtext"
            >
                Rich text
            </button>
            <button
                onclick={() => updatePreference('defaultNoteMode', 'markdown')}
                class="rounded-sm border px-4 py-2 text-sm transition-colors {prefs.defaultNoteMode === 'markdown' ? 'border-[var(--primary)] bg-[var(--primary)]/15 text-[var(--primary)] font-medium' : 'border-[var(--border-subtle)] text-[var(--text)] hover:border-[var(--primary)]'}"
                data-testid="pref-mode-markdown"
            >
                Markdown
            </button>
        </div>
    </div>

    <!-- Default note color -->
    <div class="space-y-2">
        <label class="text-sm font-medium text-[var(--text)]">Default note color</label>
        <p class="text-xs text-[var(--text-muted)]">New notes will start with this color</p>
        <ColorPicker
            selected={prefs.defaultNoteColor}
            onSelect={(color: NoteColor) => updatePreference('defaultNoteColor', color)}
        />
    </div>

    <!-- Hide footer -->
    <div class="flex items-center justify-between">
        <div>
            <label class="text-sm font-medium text-[var(--text)]">Hide footer</label>
            <p class="text-xs text-[var(--text-muted)]">Hide the "Crumbs by Bretzel" footer</p>
        </div>
        <input
            type="checkbox"
            checked={prefs.hideFooter}
            onchange={() => updatePreference('hideFooter', !prefs.hideFooter)}
            class="h-5 w-5 cursor-pointer"
            data-testid="pref-hide-footer"
        />
    </div>

    <!-- Sidebar default state -->
    <div class="flex items-center justify-between">
        <div>
            <label class="text-sm font-medium text-[var(--text)]">Sidebar open by default</label>
            <p class="text-xs text-[var(--text-muted)]">Sidebar state when opening the app on desktop</p>
        </div>
        <input
            type="checkbox"
            checked={prefs.sidebarDefaultState === 'open'}
            onchange={() => updatePreference('sidebarDefaultState', prefs.sidebarDefaultState === 'open' ? 'collapsed' : 'open')}
            class="h-5 w-5 cursor-pointer"
            data-testid="pref-sidebar-default"
        />
    </div>
</div>
```

**Step 3: Verify build passes**

Run: `make check`

**Step 4: Commit**

```
feat: add Preferences settings tab with all four preference controls
```

---

### Task 9: E2E Tests — Preferences

**Files:**
- Modify: `tests/e2e/settings.spec.ts` (add preferences test block)

**Step 1: Write the E2E tests**

Add to `tests/e2e/settings.spec.ts`:

```typescript
test.describe('Settings — Preferences', () => {
	test('Scenario: Preferences tab is the first settings tab', async ({
		authenticatedPage: page
	}) => {
		// When the user navigates to settings
		await page.goto('/settings');

		// Then the Preferences tab is visible in the navigation
		const prefsLink = page.getByRole('link', { name: 'Preferences' });
		await expect(prefsLink).toBeVisible();
	});

	test('Scenario: Default note mode can be changed to markdown', async ({
		authenticatedPage: page
	}) => {
		// Given the user is on the Preferences settings page
		await page.goto('/settings/preferences');

		// When the user selects Markdown as default note mode
		await page.getByTestId('pref-mode-markdown').click();

		// Then the Markdown button shows as selected
		await expect(page.getByTestId('pref-mode-markdown')).toHaveClass(/font-medium/);

		// And when the user creates a new note, it opens in markdown mode
		await page.goto('/');
		await page.getByTestId('new-note-btn').click();
		await expect(page.getByTestId('markdown-toggle')).toBeVisible();
		// The markdown toggle should show the "switch to rich text" icon (FileText)
		await expect(page.getByTestId('note-content-input')).toBeVisible();
	});

	test('Scenario: Footer visibility can be toggled', async ({
		authenticatedPage: page
	}) => {
		// Given the footer is visible
		await page.goto('/');
		await expect(page.locator('footer')).toBeVisible();

		// When the user hides the footer via preferences
		await page.goto('/settings/preferences');
		await page.getByTestId('pref-hide-footer').check();

		// Then the footer is hidden on the main page
		await page.goto('/');
		await expect(page.locator('footer')).not.toBeVisible();
	});

	test('Scenario: Preferences persist across page reloads', async ({
		authenticatedPage: page
	}) => {
		// Given the user sets markdown as default mode
		await page.goto('/settings/preferences');
		await page.getByTestId('pref-mode-markdown').click();

		// When the page is reloaded
		await page.reload();
		await page.goto('/settings/preferences');

		// Then the preference is still set
		await expect(page.getByTestId('pref-mode-markdown')).toHaveClass(/font-medium/);
	});
});
```

**Step 2: Run E2E tests**

Run: `make test-e2e`

**Step 3: Commit**

```
test: add E2E tests for user preferences
```

---

### Task 10: Unit Tests — Preferences Store Serialization

**Files:**
- Create: `src/lib/stores/preferences.test.ts`

**Step 1: Write unit tests for serialization/parsing logic**

Create `src/lib/stores/preferences.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { DEFAULT_PREFERENCES } from '$lib/types/preferences.js';

// Test the defaults and type structure
describe('UserPreferences defaults', () => {
	it('should have correct default values', () => {
		expect(DEFAULT_PREFERENCES.defaultNoteMode).toBe('richtext');
		expect(DEFAULT_PREFERENCES.defaultNoteColor).toBe('default');
		expect(DEFAULT_PREFERENCES.hideFooter).toBe(false);
		expect(DEFAULT_PREFERENCES.sidebarDefaultState).toBe('open');
	});

	it('should have all four preference keys', () => {
		const keys = Object.keys(DEFAULT_PREFERENCES);
		expect(keys).toHaveLength(4);
		expect(keys).toContain('defaultNoteMode');
		expect(keys).toContain('defaultNoteColor');
		expect(keys).toContain('hideFooter');
		expect(keys).toContain('sidebarDefaultState');
	});
});
```

**Step 2: Run unit tests**

Run: `pnpm vitest run src/lib/stores/preferences.test.ts`

**Step 3: Commit**

```
test: add unit tests for preferences defaults
```

---

### Task 11: Final Verification & Cleanup

**Step 1: Run full test suite**

Run: `make test`

**Step 2: Run type check**

Run: `make check`

**Step 3: Run build**

Run: `make build`

**Step 4: Manual smoke test**

Run: `make preview` and verify:
- [ ] Navigate to Settings — Preferences tab appears first
- [ ] Toggle each preference and verify it takes effect
- [ ] Reload page — preferences persist
- [ ] Create new note — uses chosen default mode and color
- [ ] Footer hides/shows based on setting
- [ ] Sidebar opens/collapses based on setting on page load

**Step 5: Final commit if any cleanup needed**

```
chore: cleanup and finalize user preferences feature
```
