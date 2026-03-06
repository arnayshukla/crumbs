# CLAUDE.md

## Project overview

Crumbs by Bretzel — self-hostable note-taking app. Single-user, offline-first PWA with CRDT-based sync.

## Tech stack

- **Framework**: SvelteKit with Svelte 5 (runes: `$state`, `$derived`, `$props`, `$effect`)
- **Adapter**: `@sveltejs/adapter-node` (builds to `build/`, runs via `node build`)
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite`)
- **Database**: SQLite via better-sqlite3 + Drizzle ORM (WAL mode, schema at `src/lib/server/db/schema.ts`)
- **Auth**: Single-user password auth with Argon2 hashing, session cookies (30-day expiry)
- **PWA**: `@vite-pwa/sveltekit` for service worker and offline caching
- **Package manager**: pnpm

## Project structure

```
src/
  routes/              # SvelteKit pages and API routes
    +page.svelte       # Main notes view
    login/             # Login page
    setup/             # First-time password setup
    api/auth/          # Login, logout, setup endpoints
    api/notes/         # CRUD + attachments
    api/search/        # Full-text search
    api/sync/          # Offline sync
    api/tags/          # Tag management
  lib/
    components/        # Svelte components (NoteCard, NoteEditor, ColorPicker, etc.)
    stores/            # Svelte stores (notes.ts, theme.ts)
    server/db/         # Drizzle schema + connection (schema.ts, index.ts)
    server/            # Auth logic, attachment handling
    sync/              # Client sync (idb.ts), CRDT merge (crdt.ts), server sync
    types/             # TypeScript interfaces (Note, Attachment, Tag, etc.)
    utils/             # Colors, markdown, tags, debounce
  hooks.server.ts      # Auth middleware (redirects unauthenticated users)
tests/
  unit/                # Vitest unit tests
  e2e/                 # Playwright e2e tests (Gherkin-style)
    helpers/fixtures.ts  # Shared authenticatedPage fixture
```

## Commands

A `Makefile` wraps all common tasks for tool-agnostic usage. Run `make help` to list targets.

| Make target | pnpm equivalent | Description |
|---|---|---|
| `make dev` | `pnpm dev` | Start dev server |
| `make build` | `pnpm build` | Production build |
| `make preview` | `pnpm preview` | Preview production build |
| `make check` | `pnpm check` | Svelte type checking |
| `make test` | `pnpm test` | Run all tests (unit + e2e) |
| `make test-unit` | `pnpm test:unit` | Run unit tests only |
| `make test-e2e` | `pnpm test:e2e` | Run e2e tests only |
| `make lint` | `pnpm lint` | Run linter |
| `make db-push` | `pnpm db:push` | Push schema to DB |
| `make db-generate` | `pnpm db:generate` | Generate migrations |
| `make db-migrate` | `pnpm db:migrate` | Run migrations |
| `make db-studio` | `pnpm db:studio` | Open Drizzle Studio |
| `make docs-api` | `pnpm docs:api` | Regenerate API docs from OpenAPI spec |
| `make install` | `pnpm install` | Install dependencies |
| `make docker-build` | — | Build Docker image |
| `make docker-up` | — | Start containers |
| `make docker-down` | — | Stop containers |
| `make docker-logs` | — | Tail container logs |
| `make clean` | — | Remove build artifacts + test DBs |
| `make release` | — | Auto-bump version from commits, tag, and push |
| `make release-patch` | — | Bump patch version, tag, and push |
| `make release-minor` | — | Bump minor version, tag, and push |
| `make release-major` | — | Bump major version, tag, and push |

## CI/CD

GitHub Actions with two workflows:

**CI** (`.github/workflows/ci.yml`) — runs on push to `main`/`claude/**` and PRs to `main`:
1. **Lint & Type Check** — `pnpm check`
2. **Unit Tests** — `pnpm test:unit`
3. **Build** — `pnpm build` (depends on steps 1+2)
4. **E2E Tests** — Playwright with Chromium (depends on step 3, uploads report on failure)
5. **Docker Build** — validates the Docker image builds (depends on step 3)

**Release** (`.github/workflows/release.yml`) — runs on `v*` tags:
- Runs full CI pipeline, then builds + pushes Docker image to `ghcr.io` (GitHub Container Registry)
- Creates a GitHub Release with auto-generated notes

**Docker**: Multi-stage Dockerfile (node:22-slim), exposes port 3000, persists data to `/data` volume.

## Testing philosophy: BDD/TDD

Write tests first or alongside features. Tests serve as living documentation of expected behavior.

### Unit tests (Vitest)

- Location: `tests/unit/*.test.ts`
- Config: `vitest.config.ts` (node environment)
- Cover pure logic: markdown parsing, tag extraction, auth, search, sync

### E2E tests (Playwright)

- Location: `tests/e2e/*.spec.ts`
- Config: `playwright.config.ts` (Chromium only, builds + previews app on port 4173)
- Test database: `./data/test-crumbs.db` (cleaned via `global-setup.ts`)
- Auth fixture: `tests/e2e/helpers/fixtures.ts` provides `authenticatedPage` (handles setup/login race conditions across parallel workers)
- Auth tests use `test.describe.serial` because they depend on sequential database state

### Gherkin-style Given/When/Then

E2E tests follow Cucumber BDD conventions via comments. Follow the [Better Gherkin](https://cucumber.io/docs/bdd/better-gherkin) guidelines:

**Declarative, not imperative** — describe *what* the system does, not *how* the user interacts with the UI:
```
// Good: "When the user trashes the note"
// Bad:  "When the user hovers over the note card and clicks the trash button"
```

**Given describes state, not navigation:**
```
// Good: "Given a note titled 'Delete Me' exists"
// Bad:  "Given the user clicks the new note button and fills in the title"
```

**Collapse multi-step UI actions into a single intent:**
```
// Good: "When the user creates a note titled 'My Note' with content 'Hello'"
// Bad:  "When they click new note / And fill in the title / And fill in the content / And close the editor"
```

**Scenario names describe outcomes/behavior, not actions:**
```
// Good: "Scenario: Trashed note disappears from the main view"
// Bad:  "Scenario: User moves a note to trash"
```

**Resilience test** — ask: *"Will this comment need to change if the UI implementation changes?"* If yes, rewrite it to remove implementation details. The Playwright code underneath handles the *how*; the comments describe the *what*.
