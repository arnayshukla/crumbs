# API Reference

All API endpoints require authentication (session cookie) except `/api/auth/setup` and `/api/auth/login`.

## Authentication

### POST /api/auth/setup
First-time setup. Creates the single user account.

**Request:**
```json
{ "password": "min8characters" }
```

**Response:** `201 Created`
```json
{ "success": true }
```
Sets `session` cookie.

### POST /api/auth/login
**Request:**
```json
{ "password": "yourpassword" }
```

**Response:** `200 OK`
```json
{ "success": true }
```
Sets `session` cookie.

### POST /api/auth/logout
Clears session.

**Response:** `200 OK`
```json
{ "success": true }
```

## Notes

### GET /api/notes
List notes by filter.

**Query Parameters:**
- `filter` - `all` (default), `archived`, `trashed`

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "title": "My Note",
    "content": "**Markdown** content",
    "color": "coral",
    "pinned": true,
    "archived": false,
    "trashed": false,
    "checklistMode": false,
    "sortOrder": 0,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "version": 1,
    "tags": ["work", "important"]
  }
]
```

### POST /api/notes
Create a new note.

**Request:**
```json
{
  "title": "My Note",
  "content": "Note content with #tags",
  "color": "default",
  "pinned": false,
  "checklistMode": false
}
```

**Response:** `201 Created` - Returns the created note.

### GET /api/notes/:id
Get a single note.

### PATCH /api/notes/:id
Update a note.

**Request:** (partial update - only include changed fields)
```json
{
  "title": "Updated Title",
  "color": "coral",
  "pinned": true
}
```

**Response:** `200 OK` - Returns the updated note.

### DELETE /api/notes/:id
Permanently delete a note.

## Search

### GET /api/search
Full-text search across notes.

**Query Parameters:**
- `q` - Search query

**Response:** `200 OK` - Array of matching notes (excluding trashed).

## Tags

### GET /api/tags
List all tags.

**Response:** `200 OK`
```json
[
  { "id": 1, "name": "work" },
  { "id": 2, "name": "personal" }
]
```

## Attachments

### GET /api/notes/:id/attachments
List attachments for a note.

### POST /api/notes/:id/attachments
Upload an image attachment.

**Request:** `multipart/form-data` with `file` field.

**Response:** `201 Created` - Returns attachment metadata.

### DELETE /api/notes/:id/attachments?attachmentId=xxx
Delete an attachment.

## Sync

### POST /api/sync
Push local changes to server.

**Request:**
```json
{
  "changes": [
    {
      "noteId": "uuid",
      "operation": "create|update|delete",
      "timestamp": 1704067200000,
      "data": { "title": "...", "content": "..." }
    }
  ]
}
```

### GET /api/sync?since=timestamp
Pull changes since a timestamp (milliseconds).

**Response:** `200 OK` - Array of notes updated since the given timestamp.
