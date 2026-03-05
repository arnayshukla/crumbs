# Crumbs by Bretzel

A self-hostable, offline-first note-taking app inspired by Google Keep. Part of the [Bretzel](https://bretzel.app) app universe. Built with SvelteKit, SQLite, and Tailwind CSS.

## Features

- **Notes CRUD** - Create, edit, and delete notes with rich Markdown support
- **Markdown** - Bold, italic, headings, lists, code blocks, tables, links
- **Checklists** - Interactive task lists with checkboxes
- **Image Attachments** - Upload and display images in notes
- **Tags** - Organize notes with inline #hashtags
- **Colors** - 12 color-coded note backgrounds (matching Google Keep)
- **Pin** - Pin important notes to the top
- **Archive** - Archive notes to declutter your main view
- **Trash** - Soft delete with restore capability
- **Search** - Full-text search across titles, content, and tags
- **Dark Mode** - System-aware with manual toggle
- **Single-User Auth** - Password-protected access
- **PWA** - Installable as a standalone app with offline support
- **Local-First** - Notes stored in IndexedDB, synced to server via LWW CRDTs
- **Docker** - Single command deployment with `docker compose up`

## Quick Start

### Docker (Recommended)

```bash
docker compose up -d
```

Open http://localhost:3000 and set your password on first visit.

### Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Run unit tests
pnpm test:unit

# Run E2E tests (requires Playwright browsers)
npx playwright install chromium
pnpm test:e2e

# Type check
pnpm check

# Build for production
pnpm build
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | SvelteKit 2 |
| Language | TypeScript (strict) |
| UI | Tailwind CSS 4 |
| Database | SQLite (better-sqlite3) |
| ORM | Drizzle ORM |
| Client DB | IndexedDB (idb) |
| Sync | LWW CRDTs |
| Auth | Argon2 + session cookies |
| Markdown | markdown-it |
| PWA | @vite-pwa/sveltekit |
| Testing | Vitest + Playwright |
| Container | Docker (multi-stage) |
| CI/CD | GitHub Actions |

## Project Structure

```
src/
├── lib/
│   ├── components/    # Svelte UI components
│   ├── server/db/     # Drizzle schema & connection
│   ├── server/auth.ts # Authentication logic
│   ├── sync/          # CRDT sync engine (client + server)
│   ├── stores/        # Svelte reactive stores
│   ├── types/         # TypeScript type definitions
│   └── utils/         # Markdown, tags, colors, debounce
├── routes/
│   ├── api/           # REST API endpoints
│   ├── login/         # Login page
│   ├── setup/         # First-run setup page
│   └── +page.svelte   # Main notes view
└── hooks.server.ts    # Auth middleware
tests/
├── unit/              # Vitest unit tests
└── e2e/               # Playwright E2E tests
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notes?filter=all\|archived\|trashed` | List notes |
| POST | `/api/notes` | Create a note |
| GET | `/api/notes/:id` | Get a note |
| PATCH | `/api/notes/:id` | Update a note |
| DELETE | `/api/notes/:id` | Delete a note permanently |
| GET | `/api/search?q=query` | Full-text search |
| GET | `/api/tags` | List all tags |
| POST | `/api/sync` | Push sync changes |
| GET | `/api/sync?since=timestamp` | Pull changes since timestamp |
| POST | `/api/auth/setup` | First-time password setup |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET/POST/DELETE | `/api/notes/:id/attachments` | Manage image attachments |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `./data/crumbs.db` | SQLite database file path |
| `DATA_DIR` | `./data` | Data directory for attachments |
| `ORIGIN` | `http://localhost:3000` | Server origin (CSRF protection) |
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Node environment |

## CI/CD

GitHub Actions workflows are included:

- **CI** (`ci.yml`): Runs on every push/PR - lint, type check, unit tests, build, E2E tests, Docker build
- **Release** (`release.yml`): Runs on version tags (`v*`) - builds and pushes Docker image to a configurable registry

Configure your registry via GitHub Secrets:
- `REGISTRY_URL` - Container registry URL
- `REGISTRY_USER` - Registry username
- `REGISTRY_TOKEN` - Registry access token

## Sync Architecture

Crumbs uses a local-first architecture with Last-Write-Wins (LWW) conflict resolution:

1. All reads come from IndexedDB (instant, works offline)
2. Writes go to IndexedDB + a sync queue
3. Background sync pushes queued changes to server every 30s
4. Server resolves conflicts using timestamps (newer wins)
5. Client pulls server changes and merges with local state

This ensures the app works fully offline and syncs automatically when connectivity is restored.

## License

MIT
