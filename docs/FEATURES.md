# Features

## Core Features (MVP)

### Notes CRUD
- Create, read, update, and delete notes
- Notes have a title and content body
- Content supports full Markdown syntax
- Auto-save on editor close

### Markdown Support
- **Bold** (`**text**`)
- *Italic* (`*text*`)
- Headings (`# H1` through `###### H6`)
- Unordered lists (`- item`)
- Ordered lists (`1. item`)
- Code blocks (triple backtick)
- Inline code (single backtick)
- Tables
- Links (auto-linkified URLs)
- Line breaks

### Checklists / Task Lists
- Toggle between regular note and checklist mode
- Add, remove, reorder checklist items
- Check/uncheck items with checkboxes
- Checked items get strikethrough styling
- Enter key adds new item, Backspace removes empty items

### Image Attachments
- Upload images via file picker or drag-and-drop
- Supports JPEG, PNG, GIF, WebP, SVG
- Max file size: 10MB
- Thumbnail previews in note cards
- Remove attachments from editor

### Tag Organization
- Inline `#hashtag` extraction from note content
- Tags automatically parsed from title and content
- Filter notes by tag (sidebar + tag chips)
- Tags are case-insensitive and deduplicated
- Tags inside code blocks and URLs are ignored

### Color-Coded Notes
12 colors matching Google Keep's palette:
- Default, Coral, Peach, Sand, Mint, Sage
- Fog, Storm, Dusk, Blossom, Clay, Chalk
- Colors adapt to light/dark mode

### Pin Notes
- Pin important notes to always appear at top
- Pinned section separated from unpinned notes
- Toggle pin from note card hover actions

### Archive
- Archive notes to declutter main view
- Archived notes accessible from sidebar
- Unarchive to restore to main view

### Trash
- Soft delete moves notes to trash
- Trash view accessible from sidebar
- Restore notes from trash
- Permanently delete from trash

### Full-Text Search
- Search across note titles, content, and tags
- Real-time search results as you type
- Clear search to restore original view
- Case-insensitive matching

### Dark Mode
- System preference detection (auto)
- Manual toggle override
- Preference persisted in localStorage
- All components adapt to theme
- Note colors adjust for dark backgrounds

### Single-User Auth
- First-run setup: create password (min 8 chars)
- Argon2 password hashing (industry standard)
- Session-based auth with 30-day expiry
- All routes protected except /login and /setup
- Logout clears session

### PWA / Offline-First
- Installable as standalone app
- Web app manifest with icons
- Service worker for asset caching
- IndexedDB for local data storage
- Background sync every 30 seconds
- LWW conflict resolution for multi-device use
- Sync status indicator (synced/syncing/offline/error)

### Docker Deployment
- Multi-stage Dockerfile (build + slim runtime)
- docker-compose.yml with persistent volume
- Health check endpoint
- Runs as non-root user
- Configurable via environment variables
