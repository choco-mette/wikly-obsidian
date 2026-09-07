<div align="center">

# Wikly

**Publish explicitly approved Obsidian notes into a modern, lightning-fast public Wiki.**

_The Obsidian Vault remains the single source of truth. PostgreSQL acts as a rebuildable public projection, and LiveSync continues to manage device-to-device synchronization._

[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-16.x-000000?logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Production_Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

## Overview

Wikly is an end-to-end self-hosted publishing platform engineered specifically for Obsidian power users. Unlike generic static site generators, Wikly maintains strict separation of concerns:

- **Vault Integrity**: Your Obsidian vault is never treated as a disposable input. Notes are published only when explicitly marked with `wiki.published: true` in frontmatter.
- **Permanent Identifiers**: Notes use stable 26-character Crockford Base32 source IDs (`wiki.id`), ensuring renames, file moves, and path reorganization never break public links or historical revisions.
- **Bi-Directional Sync**: Changes made in the web admin panel (such as tags or frontmatter properties) cleanly sync back to your physical Obsidian markdown files through a safe lease-and-ack write-back engine without publish loops.
- **Full Obsidian Compatibility**: Native support for internal wikilinks (`[[Note|Alias]]`), note transclusion / embeds (`![[Note]]`), KaTeX math, Mermaid diagrams, Excalidraw vector graphics, callouts, and frontmatter aliases with automatic 307 redirects.
- **Interactive Knowledge Graph**: High-performance 60fps Canvas force-directed graph navigation for article neighborhoods and global vault exploration.

---

## Architecture

```mermaid
flowchart TD
    subgraph Obsidian["Obsidian Ecosystem"]
        Vault[("Obsidian Vault\n(Source of Truth)")]
        LiveSync["Self-Hosted LiveSync\n(P2P Device Sync)"]
        Plugin["Wikly Obsidian Plugin"]

        Vault <--> LiveSync
        Vault <--> Plugin
    end

    subgraph Infrastructure["Wikly Server Platform"]
        Caddy["Caddy Reverse Proxy\n(Auto-TLS & HTTP/2/3)"]
        Web["Next.js App Server\n(Standalone Runtime)"]
        DB[("PostgreSQL 17\n(Public Projection)")]
        Storage[("MinIO / S3\n(Asset Storage)")]
        Backup["Automated Backup\n(Gzip Cron Worker)"]

        Caddy -->|Reverse Proxy| Web
        Web -->|Drizzle ORM| DB
        Web -->|AWS SDK v3| Storage
        Backup -->|pg_dump| DB
    end

    Plugin -->|1. Device Auth & Pairing| Web
    Plugin -->|2. Incremental Publish (SHA256)| Web
    Plugin -->|3. Deduplicated Asset Upload| Storage
    Web -->|4. Leased Write-Back Queue| Plugin
```

---

## Key Features

### 1. Markdown & Obsidian Compatibility

- **Internal Wikilinks**: Resolves `[[Target]]`, `[[Target|Custom Text]]`, and `[[Target#Heading]]`. Broken links are cleanly styled with `.wiki-link-broken`.
- **Frontmatter Aliases**: Supports `aliases: [A, B]`. Accessing a note via an alias automatically issues a 307 redirect to its canonical slug, and wikilinks pointing to aliases resolve seamlessly.
- **Transclusion & Embeds**: Embed full notes via `![[Note]]` with recursion guard protection (maximum depth of 2).
- **Interactive Knowledge Graph**: Canvas-based force-directed simulation (`d3-force`) with smooth mouse-wheel zooming, dragging, hover neighbor highlights, and direct note navigation.
- **Excalidraw Rendering**: Embedded `.excalidraw` drawings render as lightweight vector SVGs on the client without loading heavyweight canvas editors.
- **Mathematical Equations**: Server-side KaTeX rendering for `$inline$` and `$$block$$` formulas with code-block delimiters protection.
- **Mermaid Diagrams**: Client-side sequence diagrams, flowcharts, and architecture charts.
- **Obsidian Callouts**: Formatted alerts (`[!NOTE]`, `[!TIP]`, `[!WARNING]`, `[!CAUTION]`, etc.).

### 2. Asset Pipeline

- **Content-Addressable Storage**: Assets are hashed using SHA-256 (`sha256:...`). Identical files are deduplicated across the entire vault.
- **Direct S3 / Local Storage**: Presigned upload flow for large media files directly to MinIO/S3 or local persistent storage.
- **Privacy by Default**: Assets are only publicly accessible when referenced by at least one published note.
- **Garbage Collection**: Unreferenced orphan assets are tracked and cleanly pruned after a configurable retention window.

### 3. Bi-Directional Write-Back (Admin to Vault)

- Edit tags or metadata in the Wikly Web Admin.
- The server places a mutation in `pending_changes`.
- The Obsidian plugin claims a lease on the change, modifies the frontmatter locally without altering the markdown body, verifies file hash, sends an ACK, and pushes an incremental publish.

### 4. Enterprise-Grade Production Hardening

- **Multi-Stage Container**: Minimalist unprivileged Docker image (`nextjs:nodejs`) using Next.js `standalone` output.
- **Automatic Migrations**: Database startup guard using `pg_isready` with automated Drizzle migrations executed via pure Node.js runtime.
- **Reverse Proxy & Auto-TLS**: Production Caddy configuration with automated SSL certificates (Let's Encrypt / ZeroSSL), HTTP compression (Zstandard & Gzip), and aggressive static asset caching.
- **Observability**: Structured NDJSON logging with correlation request IDs and a live health check endpoint (`/api/health`).
- **Sliding-Window Rate Limiter**: In-memory token bucket rate limiting on sensitive authentication, admin login, and publishing endpoints.
- **Automated Backups**: Containerized daily `pg_dump` worker with Gzip compression and automatic 7-day retention rotation.

---

## Workspace Structure

This monorepo is managed with `pnpm workspaces`:

```text
├── apps/
│   └── web/                   # Next.js 16 application (Public Wiki, Admin, API Routes)
├── packages/
│   ├── api-contracts/         # Shared TypeScript DTOs, API endpoints, and response types
│   ├── domain/                # Pure business logic: ULID, hashing, frontmatter patch, aliases
│   └── validation/            # Zod validation schemas for all network payloads
├── plugins/
│   └── obsidian-wiki/         # Obsidian desktop & mobile plugin bridge
├── docker/
│   ├── caddy/                 # Caddyfile reverse proxy configuration
│   ├── entrypoint.sh          # Container startup guard script
│   └── migrate.js             # Standalone production database migration script
├── scripts/
│   ├── backup-db.sh           # Automated PostgreSQL backup script with rotation
│   └── restore-db.sh          # Database disaster recovery restore script
├── docker-compose.yml         # Development infrastructure (PostgreSQL & MinIO)
└── docker-compose.prod.yml    # Production multi-container composition
```

---

## Getting Started (Development)

### Prerequisites

- **Node.js**: `22.x` or newer (managed via `mise` or `nvm`)
- **pnpm**: `12.x` or newer (`corepack enable`)
- **Docker & Docker Compose**: For local PostgreSQL and MinIO services

### 1. Clone & Install

```bash
git clone https://github.com/your-username/wikly-obsidian.git
cd wikly-obsidian
pnpm install
```

### 2. Environment Setup

Copy the development environment file:

```bash
cp .env.example .env
```

Ensure passwords and ports in `.env` are configured. Default development port for PostgreSQL is `5433` (to prevent collision with local instances).

### 3. Start Infrastructure

```bash
docker compose up -d
```

### 4. Run Migrations & Seed Data

```bash
pnpm --filter @wikly/web db:migrate
pnpm --filter @wikly/web db:seed
```

### 5. Launch Development Server

```bash
pnpm dev
```

- **Public Wiki**: [http://localhost:3000](http://localhost:3000)
- **Admin Dashboard**: [http://localhost:3000/admin](http://localhost:3000/admin) (Default: `admin@wikly.local` / `admin123456`)
- **Health Check**: [http://localhost:3000/api/health](http://localhost:3000/api/health)
- **MinIO Console**: [http://localhost:9001](http://localhost:9001)

---

## Obsidian Plugin Setup

1. In another terminal, run the plugin bundler in watch mode:
   ```bash
   pnpm dev:plugin
   ```
2. Symlink or copy `plugins/obsidian-wiki` to your vault's plugin directory:
   ```bash
   ln -s "$(pwd)/plugins/obsidian-wiki" "/path/to/vault/.obsidian/plugins/wikly-publisher"
   ```
3. Open **Obsidian Settings** → **Community Plugins** → Enable **Wikly Publisher**.
4. In **Wikly Settings**:
   - Set **Server URL**: `http://localhost:3000`
   - In the Wikly Admin Panel ([http://localhost:3000/admin/devices](http://localhost:3000/admin/devices)), click **Pair New Device** to generate a 6-digit code.
   - Enter the code in Obsidian and click **Pair Device**.
5. Add frontmatter to any note you wish to publish:
   ```markdown
   ---
   wiki:
     published: true
   tags:
     - architecture
     - guide
   aliases:
     - Project Wikly Overview
   ---

   # Welcome to Wikly

   Content written in Obsidian is published instantly!
   ```

---

## Production Deployment

### 1. Prepare Production Configuration

Create `.env` on your production host:

```bash
POSTGRES_DB=wikly
POSTGRES_USER=wikly
POSTGRES_PASSWORD=generate-a-strong-database-password
POSTGRES_PORT=5432

MINIO_ROOT_USER=wikly-minio
MINIO_ROOT_PASSWORD=generate-a-strong-minio-password

ADMIN_SESSION_SECRET=generate-a-64-character-random-secret
SITE_DOMAIN=wiki.yourdomain.com
ACME_EMAIL=admin@yourdomain.com

STORAGE_DRIVER=s3
STORAGE_S3_ENDPOINT=http://minio:9000
STORAGE_S3_BUCKET=wikly-assets
STORAGE_S3_REGION=us-east-1
```

### 2. Launch Production Stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This launches 5 isolated services:

1. `caddy`: Reverse proxy with automatic Let's Encrypt TLS on port 80 & 443.
2. `web`: Minimalist Node 22 Next.js standalone runner.
3. `postgres`: PostgreSQL 17 database with persistent data volume.
4. `minio`: S3-compatible asset store.
5. `db-backup`: Automated daily cron backup worker.

### 3. Disaster Recovery & Backups

#### Manual Backup

```bash
./scripts/backup-db.sh
```

Dumps an encrypted/compressed `.sql.gz` snapshot to `./backups/` and automatically purges backups older than 7 days.

#### Restore Backup

```bash
./scripts/restore-db.sh ./backups/wikly_wikly_YYYYMMDD_HHMMSS.sql.gz
```

#### Reconcile Vault & Clean Orphans

Trigger maintenance from the admin dashboard or via API:

```bash
# Clean orphaned assets older than 24h
curl -X POST "http://localhost:3000/api/admin/maintenance?action=gc" -H "Cookie: wikly_admin_session=..."

# Reconcile all links and graph projections
curl -X POST "http://localhost:3000/api/admin/maintenance?action=reconcile" -H "Cookie: wikly_admin_session=..."
```

---

## Development Commands

| Command                                | Description                                                       |
| :------------------------------------- | :---------------------------------------------------------------- |
| `pnpm dev`                             | Starts Next.js development server with hot-reload                 |
| `pnpm dev:plugin`                      | Builds and watches the Obsidian plugin in development mode        |
| `pnpm build`                           | Compiles packages and builds Next.js standalone production bundle |
| `pnpm test`                            | Runs all 52 unit and integration tests across workspaces          |
| `pnpm lint`                            | Runs ESLint on web app and Obsidian plugin                        |
| `pnpm typecheck`                       | Typechecks all TypeScript workspaces (strict mode, zero `any`)    |
| `pnpm format`                          | Formats all files using Prettier                                  |
| `pnpm --filter @wikly/web db:generate` | Generates new Drizzle migrations from schema changes              |
| `pnpm --filter @wikly/web db:migrate`  | Runs Drizzle migrations against the target database               |

---

## Security Policy

- **Zero Unauthenticated Writes**: All publish and asset routes require valid cryptographic device tokens.
- **Strict Rate Limiting**: Token-bucket sliding window limits sensitive routes (Pairing: 10/min, Admin Login: 5/min, Publishing: 120/min).
- **Security Headers**: HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and restrictive permissions policies enforced at both Next.js and Caddy layers.
- **Safe HTML Sanitization**: Server-side HTML sanitization (`sanitize-html`) prevents XSS while whitelisting KaTeX MathML and diagram SVG structures.

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
