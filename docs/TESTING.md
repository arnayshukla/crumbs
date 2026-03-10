# E2E BDD Testing Best Practices

This document defines the 10 best practices for writing E2E tests in Crumbs. All tests use Playwright with Gherkin-style BDD comments.

## 1. Declarative scenarios, not imperative scripts

Describe **what** the system does, not **how** the user clicks through the UI.

```
// Good: "When the user creates a note titled 'Shopping List'"
// Bad:  "When the user clicks the + button, types 'Shopping List' in the title field, and clicks save"
```

If the UI changes (button moves, field renames), only the Playwright code changes — the scenario comment stays stable.

## 2. Given describes state, not navigation

`Given` sets up preconditions. It should read like a database fixture, not a user journey.

```
// Good: "Given a note titled 'Old Note' exists in the trash"
// Bad:  "Given the user creates a note, then clicks trash, then confirms deletion"
```

Use API calls or helpers like `createNote()` in `Given` steps to avoid coupling tests to unrelated UI flows.

## 3. One behavior per scenario

Each `test()` should verify **one outcome**. If you need multiple `Then` assertions about different behaviors, split them.

```ts
// Good: Two focused scenarios
test('Trashed note disappears from main view', ...)
test('Trashed note appears in trash view', ...)

// Bad: One bloated scenario testing everything
test('Trash workflow', ...) // creates, trashes, checks main, checks trash, restores...
```

## 4. Scenario names describe outcomes, not actions

Name tests by the **observable result**, not the user action that triggers it.

```ts
// Good: test('Archived note no longer appears in the main view')
// Bad:  test('User archives a note')
```

This makes test reports read like a behavior specification.

## 5. Isolate test state completely

Each test should start from a **known, clean state**. Use API-based setup/teardown or the shared `authenticatedPage` fixture.

```ts
// Use API to create/reset state before each test
test.beforeEach(async ({ authenticatedPage: page }) => {
  await page.request.put('/api/preferences', { data: { ... } });
});
```

This prevents the "test B fails because test A didn't clean up" problem — especially important since Playwright runs workers in parallel.

## 6. Use `test.describe.serial` only when truly sequential

Reserve `serial` for flows where state genuinely cascades (setup -> login -> session). For everything else, isolate with fixtures. Treat `serial` as a **code smell** — most tests should run in **any order**.

## 7. Abstract repeated UI actions into helpers

When multiple scenarios share the same UI interaction (e.g., "create a note"), extract it into a helper at the **intent level**.

```ts
// helpers/fixtures.ts
export async function createNote(page, title, content?) { ... }

// In tests — reads like BDD
await createNote(page, 'My Note', 'Hello');
```

The shared `authenticatedPage` fixture and `noteCard()` locator are examples of this pattern. The `createNote()` helper abstracts the 4-step note creation flow used across most test files.

## 8. Apply the resilience test to every comment

Before committing a Gherkin comment, ask: *"Would this comment need to change if we redesigned the UI?"*

- If **yes** — rewrite to remove implementation details
- If **no** — it's at the right abstraction level

```
// Fails (mentions hover + button):
// "When the user hovers the card and clicks the 3-dot menu"

// Passes:
// "When the user opens the note actions menu"
```

## 9. Prefer `await expect(...).toBeVisible()` over arbitrary waits

Playwright's auto-waiting is powerful. Never use `page.waitForTimeout()` — it's flaky and slow. Assert on the **expected end state** instead.

```ts
// Good: Waits intelligently for the element
await expect(page.getByText('Note saved')).toBeVisible();

// Bad: Arbitrary delay
await page.waitForTimeout(2000);
```

The exception is `waitForLoadState('networkidle')` after authentication redirects, where the full page reload makes auto-waiting insufficient.

## 10. Structure tests in the Given/When/Then rhythm

Use comments to maintain the three-act structure. This makes tests scannable and self-documenting.

```ts
test('Pinned note appears at the top of the list', async ({ authenticatedPage: page }) => {
  // Given a note titled "Important" exists
  await createNote(page, 'Important');

  // When the user pins the note
  await pinNote(page, 'Important');

  // Then it appears before unpinned notes
  const firstCard = page.locator('[data-testid="note-card"]').first();
  await expect(firstCard).toContainText('Important');
});
```

## Quick reference

| Practice | Category | Goal |
|----------|----------|------|
| 1. Declarative scenarios | Language | Stable comments despite UI changes |
| 2. Given = state | Language | Decouple setup from UI flow |
| 3. One behavior per test | Structure | Focused, debuggable tests |
| 4. Outcome-based names | Language | Test reports read as specs |
| 5. Isolate state | Reliability | No cross-test pollution |
| 6. Avoid serial | Reliability | Parallel-safe by default |
| 7. Extract helpers | Structure | DRY, intent-level code |
| 8. Resilience test | Language | UI-change-proof comments |
| 9. Auto-wait assertions | Reliability | No flaky timeouts |
| 10. Given/When/Then | Structure | Scannable three-act tests |
