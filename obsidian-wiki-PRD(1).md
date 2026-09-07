# Product Requirements Document (PRD)

# Wikly — Obsidian Knowledge Publishing Platform

**Status:** Ready for implementation  
**Primary implementation assistant:** OpenAI Codex  
**Document version:** 1.0  
**Date:** 2026-09-06

---

## 1. Product Summary

Build a self-hosted knowledge publishing platform that uses an **Obsidian Vault as the Single Source of Truth (SSOT)** and publishes selected Obsidian content into a fast public Wiki.

The system consists of:

1. **Obsidian Plugin**
   - Publishes selected Markdown pages and referenced assets.
   - Receives controlled metadata/content changes initiated from the Admin Panel.
   - Does not replace Obsidian LiveSync.
   - Uses events, hashes, queues, and debouncing so it remains lightweight.

2. **Next.js Application**
   - Public Wiki.
   - Admin Panel.
   - Authentication.
   - Publishing API.
   - Pending-change API for controlled write-back to Obsidian.
   - Search, pages, tags, backlinks, revisions, assets, whiteboards.

3. **PostgreSQL**
   - Stores the published projection/index of the Vault.
   - Stores page metadata, revisions, links, tags, asset relationships, users, sites, and pending changes.
   - It is NOT the source of truth for the Vault.

4. **Pluggable Storage Layer**
   - Stores published copies of images, PDFs, Excalidraw source files, and other allowed public assets.
   - Must support at least two storage drivers:
     - Local Filesystem
     - S3-compatible Object Storage
   - The application and Obsidian Plugin must not depend on a specific storage implementation.
   - Local development may use Local Filesystem or MinIO.
   - Production may use Local Filesystem, MinIO, AWS S3, Cloudflare R2, or another S3-compatible provider.

5. **Obsidian LiveSync**
   - Remains fully responsible for device-to-device Vault synchronization.
   - The Wiki platform must not implement a second Vault synchronization system.

### Core architectural rule

> Obsidian Vault is the source of truth. The Wiki database is a published projection. LiveSync handles device synchronization. The Obsidian Plugin is the bridge between the Vault and the Wiki.

---

# 2. Product Goals

## 2.1 Primary goals

- Publish selected Obsidian notes as a public Wiki.
- Preserve Obsidian-native authoring workflows.
- Publish only explicitly approved pages.
- Publish only assets referenced by published content.
- Support backlinks, wikilinks, tags, aliases, callouts, code blocks, embeds, Mermaid, math, and read-only Excalidraw.
- Provide an Admin Panel for managing published content and metadata.
- Allow selected Admin changes to be written back into Obsidian frontmatter.
- Keep Obsidian Vault independent from the Wiki server.
- Make the public Wiki fast through caching/static rendering/ISR where appropriate.
- Make the plugin lightweight and incremental.

## 2.2 Non-goals for MVP

Do NOT implement:

- Real-time collaborative editing.
- CRDT-based collaboration.
- A replacement for Obsidian LiveSync.
- Whole-Vault mirroring.
- Automatic publication of every file.
- Microservices.
- Kubernetes.
- Redis unless a concrete requirement appears later.
- WebSockets unless polling/SSE is proven insufficient.
- A full browser-based Markdown editor.
- Full browser-based Excalidraw editing.
- Complex workflow/approval systems.
- Multi-region infrastructure.
- AI-powered features in the MVP.

---

# 3. Target Users

## 3.1 Author

Uses Obsidian to create:

- Markdown pages
- Wikilinks
- Tags
- Properties/frontmatter
- Images
- PDFs
- Code blocks
- Mermaid diagrams
- Math
- Excalidraw files

The author expects Obsidian to remain the primary authoring environment.

## 3.2 Administrator

Uses the Admin Panel to:

- View published pages.
- Search/filter content.
- Edit supported metadata.
- Publish/unpublish pages.
- Manage tags.
- Review revisions.
- Review assets.
- See publishing/sync status.
- Inspect pending changes.
- Trigger rebuild/reconciliation operations.

## 3.3 Public reader

Reads the generated Wiki with:

- Search
- Navigation
- Wikilinks
- Backlinks
- Tags
- Related pages
- Graph view
- Read-only whiteboards
- Responsive mobile UI

---

# 4. Product Principles

1. **Obsidian-first**
   - Content is authored in Obsidian.
   - The Vault remains authoritative.

2. **Explicit publishing**
   - A page must be explicitly marked as publishable.
   - Private notes must never be published implicitly.

3. **Referenced assets only**
   - An asset becomes public only when referenced by a published page and successfully published.

4. **Projection, not replication**
   - PostgreSQL stores the public projection/index.
   - The server must be rebuildable from the Vault.

5. **Idempotent publishing**
   - Repeating the same publish operation must not create duplicate content/revisions unnecessarily.

6. **Incremental behavior**
   - Plugin operations must focus on changed files/assets.
   - Avoid full-Vault scans in the normal path.

7. **Safe write-back**
   - Admin Panel changes must be represented as pending changes and applied by the Obsidian Plugin.
   - The server never directly accesses a Vault.

8. **No sync loop**
   - LiveSync-originated changes must not create endless Wiki publish loops.

---

# 5. High-Level Architecture

```text
                         OBSIDIAN
                    SINGLE SOURCE OF TRUTH
                              |
                         LiveSync
                              |
                +-------------+-------------+
                |             |             |
               PC          Laptop          HP
                |
          Obsidian Plugin
                |
             HTTPS API
                |
                v
      +-------------------------+
      |        Next.js          |
      |-------------------------|
      | Public Wiki             |
      | Admin Panel             |
      | Publishing API          |
      | Sync/Changes API        |
      | Authentication          |
      +-----------+-------------+
                  |
          +-------+-------+
          |               |
          v               v
     PostgreSQL        Storage Layer
     published        Local / S3-compatible
     projection
```

### Responsibilities

| Component       | Responsibility                                                 |
| --------------- | -------------------------------------------------------------- |
| Obsidian        | Source of truth for content and syncable metadata              |
| LiveSync        | Device-to-device Vault sync                                    |
| Plugin          | Publish, validate, upload assets, apply pending server changes |
| Next.js         | API, admin, wiki, auth, publishing orchestration               |
| PostgreSQL      | Published projection, search/indexing, revisions, relations    |
| Storage backend | Published asset binaries                                       |
| Public Wiki     | Read-only consumption                                          |

---

# 6. Content Model

A publishable Markdown document may look like:

```yaml
---
title: MikroTik VLAN

wiki:
  id: 01JABC123XYZ
  published: true

tags:
  - mikrotik
  - networking
  - vlan

aliases:
  - VLAN MikroTik

category: networking
---
```

The `wiki.id` / `sourceId` must be stable.

### Stable identity rules

- `sourceId` identifies the logical Obsidian document.
- Renaming or moving a file must not create a new page.
- Changing title must not create a new page.
- Changing path must not create a new page.
- If the file is intentionally recreated as a new document, the new file receives a new `sourceId`.

### Publish flag

MVP convention:

```yaml
wiki:
  published: true
```

Only files with `wiki.published = true` are publishable.

The implementation must keep this convention centralized in one parser/helper so it can be changed later without touching the entire codebase.

---

# 7. Metadata Ownership

## 7.1 Obsidian-owned metadata

The following should be treated as Vault-owned by default:

- title
- tags
- aliases
- category
- content
- Markdown frontmatter
- sourceId
- publish flag

The exact list must be centralized in a metadata policy module.

## 7.2 Server/platform metadata

MVP may store generated/internal fields such as:

- database ID
- source ID
- content hash
- revision number
- published timestamp
- indexing data
- asset relations
- parsed link graph
- generated HTML/render cache
- audit information

Avoid introducing server-only metadata that silently overrides Vault metadata unless explicitly documented.

---

# 8. Admin Write-Back Policy

Admin Panel does not directly edit the Obsidian Vault.

Instead:

```text
Admin Panel
    |
    v
Next.js
    |
    v
pending_changes
    |
    v
Obsidian Plugin
    |
    v
Vault file modified
    |
    v
LiveSync
    |
    v
Other devices
```

The server creates a **pending change**.

Example:

```json
{
  "operation": "frontmatter.patch",
  "sourceId": "01JABC123XYZ",
  "baseRevision": 18,
  "patch": {
    "tags": {
      "add": ["router"],
      "remove": []
    }
  }
}
```

The plugin:

1. Claims the change.
2. Locates the file by `sourceId`.
3. Reads the latest frontmatter.
4. Applies the minimal patch.
5. Preserves the Markdown body.
6. Writes the file.
7. Publishes the resulting file.
8. Acknowledges the change.

The plugin must not replace an entire Markdown file when a targeted frontmatter patch is sufficient.

---

# 9. Core User Flows

## 9.1 Publish a Markdown page

```text
User edits Markdown
        |
Obsidian modify event
        |
Check publish flag
        |
Debounce
        |
Read current file
        |
Validate
        |
Find referenced assets
        |
Hash page + relevant metadata
        |
Check local/server known hash
        |
Upload missing assets
        |
POST /api/v1/publish
        |
Server validates and persists
        |
Public Wiki updated
```

## 9.2 Add an attachment to a published page

```text
User adds image/PDF/etc.
        |
Page changes
        |
Plugin detects referenced asset
        |
Calculate asset SHA-256
        |
POST /api/v1/assets/check
        |
If missing:
    POST /api/v1/assets/presign
        |
    Direct upload to storage backend
        |
Publish page
        |
Server records page_assets relation
```

## 9.3 Update an existing attachment

```text
Asset binary changes
        |
New SHA-256
        |
Upload new immutable object
        |
Publish page referencing new hash
        |
Old object remains until no longer referenced
```

Do not overwrite published asset binaries in place.

## 9.4 Admin changes tags

```text
Admin
  |
changes tags
  |
Next.js
  |
pending_change
  |
Plugin polls
  |
claim
  |
patch frontmatter
  |
Vault modified
  |
publish
  |
server projection updated
  |
ack
```

## 9.5 Device-to-device sync

LiveSync owns this flow:

```text
PC Obsidian <-> LiveSync/CouchDB <-> Laptop/Phone
```

The Wiki application must not participate in this synchronization path.

## 9.6 Offline Obsidian device

If no plugin device is online:

```text
Admin change
    |
pending
```

The change remains pending until a compatible plugin client connects.

No change is considered fully applied until a plugin acknowledges it.

---

# 10. Plugin Functional Requirements

## 10.1 Event-driven publishing

Plugin must subscribe to Obsidian file events such as:

- modify
- create
- rename
- delete

Normal publishing must be event-driven.

Do not scan the full Vault on every event.

## 10.2 Debouncing

Changes to the same file during active editing must be debounced.

Configurable default:

- 2-5 seconds

The exact value should be a setting.

## 10.3 Publish queue

Plugin needs a small local queue.

Requirements:

- Deduplicate the same sourceId.
- Avoid simultaneous duplicate publishes.
- Retry transient failures.
- Exponential backoff.
- Persist enough state to survive Obsidian restart.
- Never lose an acknowledged user action because of a temporary network error.

## 10.4 Hashing

Use SHA-256 or equivalent cryptographically strong content hashing.

Store:

- `sourceId`
- local content hash
- last successful server revision

The plugin must use hashes to suppress duplicate publishing.

## 10.5 Local state

Plugin state should remain small.

Example:

```ts
interface PublishedFileState {
  sourceId: string
  path: string
  lastPublishedHash: string
  serverRevision: number
}

interface PluginState {
  files: Record<string, PublishedFileState>
  syncCursor: string
}
```

This state is a cache, not a source of truth.

## 10.6 Pending changes

Plugin must poll for pending server changes.

MVP:

- Poll on plugin load.
- Poll on Obsidian activity/resume.
- Poll on configurable interval.
- Manual "Sync Now" action.

Suggested default interval: several minutes, configurable.

Do not poll every second.

## 10.7 Change claiming

To avoid multiple devices applying the same change simultaneously:

```text
claim -> apply -> ack
```

The claim must have a lease/expiration.

## 10.8 Write-back safety

For frontmatter updates:

1. Read current file.
2. Parse frontmatter.
3. Apply targeted mutation.
4. Preserve unknown fields.
5. Preserve Markdown body.
6. Write file.
7. Re-read if necessary.
8. Publish resulting state.

## 10.9 Loop suppression

Changes resulting from applying a server change must not recursively cause uncontrolled publishing.

Use a combination of:

- internal "applying server change" state
- content hashes
- idempotent publish endpoint

Do not rely solely on event-source detection.

## 10.10 Plugin UI

Provide a compact status panel displaying:

```text
Wiki Publisher
-----------------------
Connection       ● Online
Published        187
Pending          2
Failed           0
Last sync        22:31
Last publish     22:29

[ Sync Now ]
[ Publish Current File ]
```

For the current file:

```text
MikroTik VLAN

Published        ✓
Server Revision  18
Local State      Synced

[ Publish ]
[ Open Wiki ]
[ Unpublish ]
```

Provide a publish validation view.

---

# 11. Publish Validation

Before publishing, validate:

```text
✓ Markdown valid
✓ Frontmatter valid
✓ Wikilinks resolvable
✓ Images/assets found
✓ Asset sizes allowed
✓ No prohibited asset type
✓ No private dependency
✓ Excalidraw file valid
✓ No invalid public reference
```

At minimum, detect:

- Missing images
- Missing embeds
- Broken internal links
- Missing referenced Excalidraw files
- File size violations
- Unsupported asset MIME types

MVP can warn for unresolved page links but must never expose arbitrary vault files as public assets.

---

# 11A. Storage Abstraction

Wikly must use a storage abstraction so the publishing pipeline does not depend directly on Local Filesystem or S3.

## Storage drivers

Minimum implementations:

```text
StorageDriver
├── LocalStorageDriver
└── S3StorageDriver
```

Future drivers may include:

```text
├── R2StorageDriver
├── MinIOStorageDriver
└── AzureBlobStorageDriver
```

`MinIOStorageDriver` is optional because MinIO speaks the S3 API and can use `S3StorageDriver`.

## Interface

The storage layer should expose a small interface similar to:

```ts
interface StorageDriver {
  put(input: PutObjectInput): Promise<StoredObject>
  get(key: string): Promise<ReadableStream | Buffer>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
  getPublicUrl(key: string): string
}
```

The exact interface may be adjusted to fit the selected runtime, but the application domain must depend on the abstraction rather than a concrete provider.

## Configuration

Example local configuration:

```env
STORAGE_DRIVER=local
STORAGE_LOCAL_PATH=/data/wiki-assets
```

Example S3-compatible configuration:

```env
STORAGE_DRIVER=s3
S3_ENDPOINT=https://storage.example.com
S3_BUCKET=wikly-assets
S3_REGION=auto
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
```

The implementation must keep provider credentials server-side.

## Upload behavior

The server decides how assets are uploaded.

For storage backend:

```text
Plugin
  |
  +-> request presigned upload
          |
          +-> direct upload to S3-compatible Object Storage
```

For local filesystem:

```text
Plugin
  |
  +-> authenticated upload API
          |
          +-> LocalStorageDriver
```

The Plugin must not need to know which backend is configured.

A storage negotiation response may use a structure similar to:

```json
{
  "method": "presigned",
  "assetId": "asset_001",
  "uploadUrl": "https://..."
}
```

or:

```json
{
  "method": "api",
  "assetId": "asset_001",
  "uploadUrl": "/api/v1/assets/upload/asset_001"
}
```

## Storage key strategy

Use immutable content-addressed keys:

```text
sites/{siteId}/assets/{sha256}
```

For Local Filesystem, shard by hash if necessary:

```text
/data/wiki-assets/
└── sites/
    └── site_123/
        └── assets/
            ├── ab/
            │   └── abc123...
            └── de/
                └── def456...
```

Do not rely on the original filename as the physical storage identity.

## Public URL strategy

Do not persist hard-coded provider-specific public URLs as the canonical asset identity.

Persist:

- asset ID
- hash
- storage key
- metadata

Generate the final public URL through the active storage driver or application asset route.

This allows the storage backend to be changed later without rewriting page content.

## Admin configuration

The Admin Panel should expose storage configuration at site/deployment level according to the selected architecture.

Example:

```text
Storage

○ Local server
● S3-compatible Object Storage backend

Endpoint
Bucket
Region
Access Key
Secret Key

[ Test Connection ]
```

Credentials must be masked and never displayed after initial entry.

## Storage migration

The architecture should allow a future migration:

```text
Local Filesystem
      |
      v
S3-compatible Object Storage
```

without changing page/source IDs or asset references.

The migration operation is outside the MVP but the storage abstraction must not prevent it.

---

# 12. Attachment Requirements

## 12.1 Supported initial assets

At minimum:

- PNG
- JPEG
- GIF
- WebP
- SVG (with security sanitization)
- PDF
- Excalidraw files

Design the asset layer so additional MIME types can be added later.

## 12.2 Asset identity

Use:

```text
SHA-256(binary)
```

as the deduplication basis.

Do not use filename alone.

## 12.3 Upload

The storage driver determines the upload mechanism.

For storage backend:

```text
Plugin -> presigned URL -> S3-compatible Object Storage
```

For local storage:

```text
Plugin -> authenticated upload API -> LocalStorageDriver
```

Large object-storage uploads should bypass Next.js application memory.

Local storage may use the application upload route because the binary ultimately resides on the same server. The implementation must enforce configured size limits and avoid unbounded memory buffering.

## 12.4 Storage key

Recommended pattern:

```text
sites/{siteId}/assets/{sha256}
```

Keep the content hash in the database.

## 12.5 Asset security

Never assume:

```text
attachments/foo.png
```

is safe merely because it is inside an attachments folder.

Only referenced assets from publishable content can become public.

Security-sensitive formats such as SVG must be sanitized or served safely.

## 12.6 Orphan handling

Do not immediately delete an asset when one page stops referencing it.

Maintain relation-based cleanup.

Potential state:

```text
orphaned_at
```

Garbage collection can be delayed.

---

# 13. Markdown and Obsidian Feature Support

## MVP

Support:

- Markdown
- Headings
- Paragraphs
- Lists
- Tables
- Code blocks
- Wikilinks
- Backlinks
- Tags
- Frontmatter/properties
- Aliases
- Images
- PDFs/attachments
- Callouts
- Embeds that can be safely projected
- Mermaid
- Math/LaTeX
- Read-only Excalidraw

## Later

- Transclusion improvements
- Canvas
- Advanced graph controls
- Auto-related pages
- Content quality analysis
- AI-assisted search
- Multi-site publishing
- Custom-domain management

---

# 14. Excalidraw Requirements

Excalidraw is read-only on the public Wiki.

No collaborative editing.

Publishing model:

```text
.excalidraw source
        |
Plugin
        |
Object Storage
        |
Wiki renderer
        |
Read-only whiteboard
```

Prefer preserving the source `.excalidraw` data rather than flattening everything to PNG.

A preview image/SVG may be generated if useful.

The user must always retain the original source in Obsidian.

---

# 15. Public Wiki Requirements

## 15.1 Home page

Include:

- Logo/site title
- Search
- Navigation
- Featured/popular topics
- Recent pages
- Optional graph entry
- Responsive layout

## 15.2 Article page

Include:

- Breadcrumbs
- Title
- Last updated
- Tags
- Main content
- Table of contents
- Related pages
- Backlinks
- Optional edit/admin link
- Responsive reading layout

## 15.3 Search

MVP:

- PostgreSQL full-text search or equivalent native PostgreSQL strategy.

Later:

- Meilisearch/OpenSearch if scale requires it.

## 15.4 Tags

Provide:

- Tag list
- Tag page
- Pages by tag
- Tag counts

## 15.5 Graph view

Provide a read-only relationship graph.

Graph data originates from `page_links`.

MVP can be limited to:

- current page neighborhood
- bounded depth
- optional whole-site graph later

## 15.6 Performance

Public page requests must not require expensive Markdown parsing and database work on every request.

Prefer:

- Server Components
- static rendering
- ISR/cache
- cache revalidation on publish

The exact strategy should follow the chosen Next.js architecture and current best practices.

---

# 16. Admin Panel Requirements

## Dashboard

Display:

- Published pages
- Draft/unpublished pages known to server
- Tags
- Assets
- Whiteboards
- Pending changes
- Failed changes
- Recent activity

## Pages

Features:

- Search
- Filter by status
- Filter by tags
- Open public page
- See source path
- See sourceId
- See revision
- Publish/unpublish
- Metadata editing where supported
- Revision history

## Tags

Features:

- List tags
- Rename/merge strategy must be carefully specified before implementation
- Add/remove tag from page
- Show pages using a tag

For MVP, tag rename/merge can be implemented as a sequence of safe frontmatter write-backs, not as a direct database-only mutation.

## Assets

Show:

- filename
- MIME type
- size
- hash
- referenced pages
- upload date
- orphan status

## Pending changes

Show:

```text
Pending
Claimed
Applied
Failed
```

and provide error details.

## Devices & Pairing Management

Features:

- Create device: Admin specifies device name -> generates a secure one-time pairing code (e.g. `WIK-8821`, valid for 15 minutes).
- List connected plugin devices across status tabs:
  - `Pending` (awaiting pairing from Obsidian plugin)
  - `Approved` (paired and authorized to publish/sync)
  - `Revoked` (access permanently revoked)
- Display device metadata: device name, site, created date, last seen timestamp, approved date.
- Device administration actions:
  - Generate/regenerate pairing code for pending device
  - Revoke token (immediately terminates device publishing privileges)

---

# 17. API Contract

Base path:

```text
/api/v1
```

Authentication must be required for all plugin endpoints.

## 17.1 Device authentication

```http
POST /api/v1/auth/device
```

Purpose:

- Pair an Obsidian plugin device using a short, time-limited, one-time pairing code (`pairingCode`).
- Admin initiates device creation in Admin Panel / CLI: generates a unique device entry with a temporary pairing code (e.g. `WIK-8821`, valid for 15 minutes) stored as a secure hash in the `devices` table.
- When plugin submits the valid code, server issues a permanent scoped bearer token, marks the device as `approved`, and burns (invalidates) the pairing code.
- Prevents unauthorized pairing without needing shared site passwords.

Do not hard-code credentials in the plugin.

Request:

```json
{
  "siteId": "site_123",
  "pairingCode": "WIK-8821"
}
```

Response:

```json
{
  "success": true,
  "deviceId": "dev_123",
  "name": "MacBook Pro Obsidian",
  "token": "wikly_dev_...",
  "status": "approved"
}
```

If pairing code is invalid or expired:

```http
401 Unauthorized
```
```json
{
  "success": false,
  "error": "Invalid or expired pairing code."
}
```

If device token is revoked or not approved:

```http
403 Forbidden
```
```json
{
  "success": false,
  "error": "Device access has been revoked or is not authorized."
}
```

## 17.2 Publish

```http
POST /api/v1/publish
```

Request:

```json
{
  "siteId": "site_123",
  "sourceId": "01JABC123XYZ",
  "path": "Networking/MikroTik VLAN.md",
  "title": "MikroTik VLAN",
  "slug": "mikrotik-vlan",
  "markdown": "# MikroTik VLAN\n\n...",
  "frontmatter": {
    "title": "MikroTik VLAN",
    "tags": ["mikrotik", "networking", "vlan"],
    "wiki": {
      "id": "01JABC123XYZ",
      "published": true
    }
  },
  "contentHash": "sha256:...",
  "serverRevision": 17,
  "assets": [
    {
      "assetId": "asset_001",
      "path": "images/vlan-topology.png",
      "hash": "sha256:..."
    }
  ]
}
```

Response:

```json
{
  "success": true,
  "changed": true,
  "page": {
    "id": "page_123",
    "sourceId": "01JABC123XYZ",
    "revision": 18,
    "slug": "mikrotik-vlan"
  },
  "contentHash": "sha256:..."
}
```

If unchanged:

```json
{
  "success": true,
  "changed": false,
  "page": {
    "id": "page_123",
    "sourceId": "01JABC123XYZ",
    "revision": 18
  }
}
```

## 17.3 Asset check

```http
POST /api/v1/assets/check
```

Request:

```json
{
  "hash": "sha256:...",
  "size": 238421
}
```

Response:

```json
{
  "exists": true,
  "assetId": "asset_001"
}
```

or:

```json
{
  "exists": false
}
```

## 17.4 Presign

```http
POST /api/v1/assets/presign
```

Request:

```json
{
  "filename": "vlan-topology.png",
  "mimeType": "image/png",
  "size": 238421,
  "hash": "sha256:..."
}
```

Response:

```json
{
  "assetId": "asset_001",
  "uploadUrl": "https://...",
  "storageKey": "sites/site_123/assets/sha256..."
}
```

## 17.5 Pending changes

```http
GET /api/v1/sync/changes?cursor=123
```

Response:

```json
{
  "changes": [
    {
      "id": "change_987",
      "sourceId": "01JABC123XYZ",
      "baseRevision": 18,
      "operation": "frontmatter.patch",
      "patch": {
        "tags": {
          "add": ["router"],
          "remove": []
        }
      },
      "createdAt": "2026-09-06T15:00:00Z"
    }
  ],
  "nextCursor": "124"
}
```

## 17.6 Claim

```http
POST /api/v1/sync/changes/{id}/claim
```

Returns a lease token/expiration.

## 17.7 Acknowledge

```http
POST /api/v1/sync/changes/{id}/ack
```

Request:

```json
{
  "success": true,
  "leaseId": "lease_xyz",
  "result": {
    "sourceId": "01JABC123XYZ",
    "contentHash": "sha256:..."
  }
}
```

## 17.8 Failure

The plugin should report:

```json
{
  "success": false,
  "leaseId": "lease_xyz",
  "errorCode": "FILE_NOT_FOUND",
  "message": "The source file could not be found."
}
```

The server must retain enough information for retry/debugging.

---

# 18. Concurrency and Revision Rules

Use optimistic concurrency.

Each published page has:

```text
revision
contentHash
```

Publish request includes the client's known revision.

Example:

```text
Client revision = 18
Server revision = 18
```

Accepted.

If:

```text
Client revision = 18
Server revision = 19
```

server returns conflict:

```http
409 Conflict
```

The plugin should fetch/inspect the newer state and apply an explicit resolution strategy.

For MVP, do not build a sophisticated merge editor.

For frontmatter-only Admin patches, prefer semantic patches such as:

```json
{
  "tags": {
    "add": ["router"],
    "remove": ["old-tag"]
  }
}
```

instead of replacing entire arrays when possible.

---

# 19. Database Schema

Use PostgreSQL.

Suggested core tables:

## users

```text
id
email / username
password_hash or auth provider reference
created_at
updated_at
```

## sites

```text
id
name
slug
created_at
updated_at
```

## pages

```text
id
site_id
source_id
path
title
slug
markdown
frontmatter_json
status
content_hash
revision
published_at
created_at
updated_at
```

Constraints:

```text
UNIQUE(site_id, source_id)
UNIQUE(site_id, slug)
```

## page_revisions

```text
id
page_id
revision
markdown
frontmatter_json
content_hash
source_path
created_at
```

## assets

```text
id
site_id
hash
filename
mime_type
size_bytes
storage_key
created_at
orphaned_at
```

Constraint:

```text
UNIQUE(site_id, hash)
```

## page_assets

```text
page_id
asset_id
source_path
created_at
```

Primary key:

```text
(page_id, asset_id)
```

## page_links

```text
source_page_id
target_page_id
link_text
created_at
```

## tags

```text
id
site_id
name
slug
created_at
```

## page_tags

```text
page_id
tag_id
```

## pending_changes

```text
id
site_id
source_id
operation
payload_json
status
lease_id
lease_expires_at
attempt_count
last_error
created_at
claimed_at
applied_at
```

## devices

```text
id
site_id
name
pairing_code_hash
pairing_code_expires_at
token_hash
status
approved_at
approved_by
last_seen_at
created_at
```

Device statuses:
- `pending`: Device created by admin, awaiting initial pairing from Obsidian plugin. Cannot publish.
- `approved`: Successfully paired via valid pairing code. Bearer token active and authorized to publish.
- `revoked`: Device access permanently deactivated.

Security:
- `pairing_code_hash`: One-way cryptographic hash of temporary pairing code. Invalidated and cleared immediately after successful pairing.
- `token_hash`: Cryptographic SHA-256 hash of permanent device bearer token. Plain token returned to client once upon pairing. Raw tokens are never stored in the database.

---

# 20. Search and Indexing

MVP should prefer PostgreSQL.

Index at minimum:

- `pages.source_id`
- `pages.slug`
- `pages.status`
- `pages.updated_at`
- `tags.slug`
- `page_tags.page_id`
- `page_tags.tag_id`
- `page_links.source_page_id`
- `page_links.target_page_id`
- search vectors/fields as appropriate

Search implementation should be abstracted behind a small interface so Meilisearch can be added later without rewriting the UI.

---

# 21. Rendering Architecture

Markdown rendering should be server-side.

Use a well-established Markdown processing pipeline.

Conceptually:

```text
Markdown
   |
parse
   |
sanitize
   |
resolve Wikilinks
   |
resolve assets
   |
render HTML/React
   |
cache/ISR
```

Never trust raw published Markdown as safe HTML.

Sanitize user-authored HTML and dangerous URL schemes.

---

# 22. Security Requirements

## 22.1 Publishing isolation

A user publishing one file must not automatically publish:

- neighboring Markdown files
- arbitrary attachments
- private files
- unreferenced assets

## 22.2 Asset validation

Validate:

- MIME type
- extension
- size
- binary where practical
- storage path

Avoid executing uploaded content.

## 22.3 SVG

SVG requires explicit sanitization or a safe serving strategy.

## 22.4 Path traversal

Never trust Obsidian paths from the client as filesystem locations on the server.

The server must treat `path` as metadata only.

## 22.5 Authentication

All plugin endpoints require authentication.

Use:

- per-device one-time pairing codes, generated by the administrator and stored as one-way cryptographic hashes in the `devices` table with short expiration (15-30 minutes).
- per-device revocable bearer tokens, stored as secure SHA-256 hashes in the `devices` table.
- two-stage device onboarding: (1) administrator pre-authorizes device and generates one-time pairing code, (2) plugin exchanges valid code for active bearer token (`approved`).
- HTTPS in production.
- rate limiting on pairing and publishing endpoints.

## 22.6 Authorization

A device/user must only be able to:

- publish to authorized site(s) when the device status is explicitly `approved`. Devices in `pending`, `rejected`, or `revoked` status must be rejected with `403 Forbidden`.
- read authorized pending changes.
- acknowledge changes it has claimed.

## 22.7 Admin security

Admin Panel requires authenticated user sessions.

Implement authorization boundaries from the beginning even if MVP has one admin role.

## 22.8 SSRF and URL security

Do not fetch arbitrary remote URLs from Markdown automatically.

MVP external embeds should be allowlisted or omitted.

---

# 23. Performance Requirements

## Plugin

Normal idle overhead should be minimal.

Requirements:

- No full-Vault scan during normal file edits.
- Debounce modify events.
- Deduplicate publish jobs.
- Avoid repeated asset uploads via content hashing.
- Use direct-to-object-storage uploads.
- Poll sync changes infrequently and configurably.

## Server

Public Wiki:

- Use caching/static rendering/ISR where appropriate.
- Avoid parsing and querying everything on every request.
- Revalidate affected pages after publish.

Admin/API:

- Standard server-side database access is acceptable.
- Avoid premature caching.

## Target behavior

A normal one-page edit should involve:

```text
1 file read
1 content hash
0-N asset hash checks
0-N asset uploads
1 publish request
```

not a full Vault scan.

---

# 24. Observability

MVP should include structured logs for:

- publish start
- publish success
- publish failure
- asset upload start/success/failure
- pending change created
- pending change claimed
- pending change applied
- pending change failed
- authentication failures

Include:

- request ID
- site ID
- source ID
- page ID where available
- operation
- duration

Never log:

- access tokens
- passwords
- raw secret content

---

# 25. Error Handling

Classify errors.

## Retryable

- network timeout
- temporary storage backend failure
- 5xx responses
- connection reset

## Non-retryable

- unauthorized
- invalid frontmatter
- unsupported MIME type
- file not found
- permission denied
- invalid sourceId
- revision conflict requiring user resolution

Implement exponential backoff for retryable errors.

---

# 26. Project Structure

Recommended monorepo:

```text
obsidian-wiki/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── (public)/
│       │   ├── admin/
│       │   └── api/
│       ├── components/
│       ├── lib/
│       │   ├── auth/
│       │   ├── db/
│       │   ├── markdown/
│       │   ├── publishing/
│       │   ├── storage/
│       │   └── sync/
│       └── ...
│
├── packages/
│   ├── api-contracts/
│   ├── domain/
│   └── validation/
│
├── plugins/
│   └── obsidian-wiki/
│       ├── src/
│       ├── manifest.json
│       └── ...
│
├── drizzle/
│   └── migrations/
│
├── docker/
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

The exact structure can change if Codex identifies a materially better structure, but the separation of domain/API contracts/plugin should remain clear.

---

# 27. Recommended Technology Stack

Use:

- TypeScript
- Next.js App Router
- React
- Node.js runtime where needed
- PostgreSQL
- Drizzle ORM
- Zod
- Markdown processing based on unified/remark/rehype or an equivalent well-supported pipeline
- S3-compatible Object Storage backend
- MinIO for local development
- Docker Compose
- Caddy or equivalent reverse proxy for production
- Obsidian Plugin API
- LiveSync remains external to this project

Do not aggressively pin dependency versions in the PRD. During implementation, Codex must verify current compatible versions and current official documentation.

---

# 28. Development Phases

## Phase 0 — Repository bootstrap

Deliver:

- Monorepo/workspace
- Next.js app
- Obsidian plugin scaffold
- TypeScript
- linting
- formatting
- test framework
- Docker Compose
- PostgreSQL
- MinIO (optional S3-compatible storage)
- local asset volume
- environment configuration
- README

Acceptance criteria:

- Web app starts.
- Plugin builds.
- PostgreSQL starts.
- MinIO starts.
- Tests run.
- No secret is committed.

---

## Phase 1 — Domain model and database

Implement:

- users
- sites
- pages
- page_revisions
- assets
- page_assets
- page_links
- tags
- page_tags
- pending_changes
- devices

Implement migrations and seeds.

Acceptance criteria:

- Migrations succeed on a fresh database.
- Constraints are enforced.
- Basic repository/data-access tests pass.

---

## Phase 2 — Basic public Wiki

Implement:

- home
- page route
- tags
- backlinks
- basic search
- responsive layout
- Markdown rendering
- syntax highlighting
- callouts
- internal links
- asset rendering

Acceptance criteria:

- A manually inserted page can be rendered.
- Internal links work.
- Backlinks work.
- Assets render.
- Public pages are cached appropriately.

---

## Phase 3 — Obsidian plugin publishing MVP

Implement:

- connection settings
- device authentication
- sourceId generation
- publish flag
- modify/create/rename/delete event handling
- debounce
- content hashing
- publish queue
- publish endpoint integration
- publish validation
- basic status UI

Acceptance criteria:

- Marked page can be published.
- Editing it triggers incremental republish.
- Unpublished pages are ignored.
- Rename keeps the same sourceId.
- Duplicate publish does not create unnecessary revisions.

---

## Phase 4 — Asset pipeline

Implement:

- asset reference extraction
- hash-based dedupe
- asset check endpoint
- presigned upload endpoint
- direct storage upload
- page_assets relation
- orphan tracking

Acceptance criteria:

- New image uploads.
- Existing identical asset is not uploaded twice.
- Asset is only public when referenced by a published page.
- Removed references do not immediately destroy shared assets.

---

## Phase 5 — Admin Panel

Implement:

- auth
- dashboard
- pages
- tags
- assets
- revisions
- pending changes
- devices & one-time pairing code management
- device revocation workflow
- status UI

Acceptance criteria:

- Admin can inspect published content.
- Admin can manage supported metadata.
- Admin can pre-authorize new devices and issue one-time pairing codes.
- Admin can inspect connected devices and revoke active tokens.
- Changes become pending changes rather than database-only mutations.

---

## Phase 6 — Admin-to-Obsidian write-back

Implement:

- sync changes API
- cursor
- claim lease
- apply frontmatter patch
- ACK
- failure/retry
- sync status UI

Acceptance criteria:

- Admin adds/removes a tag.
- Plugin receives the pending change.
- Plugin modifies the correct file.
- File body remains intact.
- Vault becomes updated.
- Publish runs.
- Server projection becomes updated.
- Change becomes applied.
- LiveSync can distribute the file to other devices without creating a publish loop.

---

## Phase 7 — Graph, Excalidraw, advanced Obsidian compatibility

Implement:

- graph view
- Excalidraw read-only rendering
- aliases
- improved embed handling
- Mermaid
- math
- related pages

Acceptance criteria:

- Supported Obsidian content renders correctly.
- Excalidraw is read-only.
- Graph navigation works.
- Broken references are surfaced appropriately.

---

## Phase 8 — Production hardening

Implement:

- production Docker Compose
- reverse proxy
- TLS
- backups
- structured logging
- rate limiting
- health checks
- migration strategy
- storage lifecycle/garbage collection
- security review
- recovery/reconciliation

Acceptance criteria:

- Fresh production-like deployment succeeds.
- Restore from DB backup works.
- Wiki can be rebuilt from Vault publish operations.
- Plugin reconnect/retry works after server outage.

---

# 29. Reconciliation

Implement a manual/admin operation:

```text
Reconcile Vault
```

Purpose:

- Detect pages whose plugin state is stale.
- Republish selected content.
- Repair missing page/asset projections.

This is allowed to scan a larger set of files because it is an explicit maintenance operation.

It must NOT run automatically on every file change.

---

# 30. Failure Recovery

## Server unavailable

Plugin must:

- retain local publish queue
- retry later
- show offline status

## Storage backend unavailable

Plugin must:

- fail the publish job cleanly
- keep the page pending
- retry if retryable

## Plugin device offline

Server keeps pending changes.

## Database restored

Rebuild projection by republishing from Vault.

## Plugin state lost

Reconstruct state from:

- Vault `sourceId`
- hashes
- server responses
- explicit reconciliation

Do not depend on local plugin state for data integrity.

---

# 31. Testing Requirements

## Unit tests

At minimum:

- sourceId generation
- frontmatter parsing
- publish flag detection
- hash generation
- asset extraction
- wikilink extraction
- frontmatter patching
- tag patching
- queue deduplication
- change state transitions

## Integration tests

At minimum:

- publish page end-to-end
- upload asset end-to-end
- admin creates pending change
- plugin claims/applies/acks change
- revision conflict
- retryable failure
- duplicate publish

## Security tests

At minimum:

- private page cannot publish
- unreferenced asset cannot become public
- unauthorized device cannot publish
- invalid token rejected
- path traversal rejected
- dangerous HTML sanitized
- SVG handling verified

## E2E tests

At minimum:

```text
Obsidian-like payload
 -> publish API
 -> database
 -> public page
```

and:

```text
Admin change
 -> pending change
 -> plugin apply simulation
 -> publish
 -> public projection
```

---

# 32. Acceptance Criteria for MVP

MVP is complete only when all of the following work:

### Publishing

- User can mark a Markdown page as published.
- Plugin publishes it.
- Wiki displays it.
- Editing it updates the Wiki.
- Renaming/moving the file preserves identity.
- Unpublishing removes/hides it from the public Wiki according to the defined policy.

### Assets

- Images publish.
- PDFs publish.
- Assets are deduplicated by hash.
- Local Filesystem storage works.
- S3-compatible Object Storage works through the same StorageDriver abstraction.
- Switching storage drivers does not change page IDs, source IDs, or logical asset identities.
- Unreferenced/private assets are not automatically published.
- Direct-to-storage upload works.

### Admin

- Admin can view pages.
- Admin can view tags.
- Admin can add/remove tags.
- Admin change is represented as a pending change.
- Plugin applies the change to Obsidian.
- Result is republished.

### Multi-device

- LiveSync remains independent.
- A change applied on one Obsidian device can reach another device through LiveSync.
- The second device does not produce an infinite publish loop.

### Safety

- PostgreSQL is never treated as Vault SSOT.
- The platform remains recoverable from the Vault.
- Public access is never granted to arbitrary files merely because they exist in the Vault.

---

# 33. Codex Execution Instructions

Codex should treat this PRD as the product contract.

## Before coding

1. Inspect the repository.
2. Confirm whether a codebase already exists.
3. Inspect installed package managers and runtime.
4. Inspect existing conventions.
5. Create a concise implementation plan in the repository.
6. Identify assumptions that affect architecture.
7. Verify current official documentation for major framework/library APIs before using them.
8. Do not assume old Next.js/Obsidian API behavior.

## Implementation behavior

- Work incrementally.
- Keep changes reviewable.
- Prefer small commits/steps.
- Write tests with each major subsystem.
- Do not build future features prematurely.
- Do not introduce microservices.
- Do not add Redis/Kafka/Kubernetes unless a concrete requirement is demonstrated.
- Do not introduce a second sync mechanism for the Vault.
- Keep domain logic independent from React components.
- Keep API contracts centralized.
- Validate all external input with schemas.
- Use migrations for database changes.
- Keep secrets out of source control.

## Important architectural constraints

Codex MUST preserve:

```text
Obsidian = SSOT
LiveSync = device sync
Plugin = publishing bridge
Next.js = application/API/Wiki/Admin
PostgreSQL = published projection
Storage Layer = published asset copy (Local Filesystem or S3-compatible Object Storage)
```

Codex MUST NOT turn PostgreSQL into the source of truth for Vault content.

Codex MUST NOT implement a whole-Vault mirror.

Codex MUST NOT make arbitrary Vault files public.

Codex MUST NOT overwrite an entire Markdown file for a metadata-only admin change.

---

# 34. Definition of Done for Each Feature

A feature is complete only when:

1. Code is implemented.
2. Types are correct.
3. Validation exists.
4. Error handling exists.
5. Tests exist.
6. The UI state is understandable.
7. Security implications are addressed.
8. Documentation is updated.
9. Migration exists when required.
10. The feature does not violate the SSOT/LiveSync architecture.

---

# 35. Suggested First Coding Task for Codex

Start with only the foundation.

### Task

Implement **Phase 0 + the beginning of Phase 1**:

1. Create workspace/monorepo.
2. Create Next.js application.
3. Create Obsidian plugin scaffold.
4. Configure TypeScript/lint/format/tests.
5. Create Docker Compose:
   - PostgreSQL
   - MinIO (optional S3-compatible profile)
   - persistent local asset volume
6. Configure environment variables.
7. Add Drizzle configuration.
8. Create initial database schema for:
   - sites
   - pages
   - page_revisions
   - assets
   - page_assets
   - page_links
   - tags
   - page_tags
   - pending_changes
   - devices
9. Create migrations.
10. Add basic repository/data-access layer.
11. Add README with local development instructions.
12. Add a minimal health endpoint.
13. Add automated tests that verify:
    - database connection
    - migration success
    - basic page insert/read
    - sourceId uniqueness

Do NOT implement the full Admin Panel, Wiki frontend, or complete plugin publishing workflow in the first coding step.

The goal of the first step is a clean, tested foundation that can be extended in subsequent phases.

---

# 36. Recommended Implementation Sequence After Foundation

```text
Foundation
   |
   v
Database/domain
   |
   v
Public Wiki
   |
   v
Plugin publish
   |
   v
Asset pipeline
   |
   v
Admin Panel
   |
   v
Admin -> Obsidian write-back
   |
   v
Graph + Excalidraw
   |
   v
Production hardening
```

Avoid implementing these in parallel unless dependencies are already stable.

---

# 37. Final Product Principle

Wikly should feel like:

```text
Obsidian
   =
Authoring + Knowledge Graph + SSOT

LiveSync
   =
Device Synchronization

Wiki Platform
   =
Publishing + Management + Public Delivery
```

The system is not an Obsidian replacement and not a generic CMS.

It is an **Obsidian-native publishing platform** that turns a controlled subset of an Obsidian Vault into a secure, searchable, fast, self-hosted Wiki.
