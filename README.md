# Wikly

Wikly publishes explicitly approved Obsidian notes into a public Wiki. The
Obsidian Vault is always the source of truth; PostgreSQL is a rebuildable public
projection, and LiveSync continues to own device-to-device Vault sync.

## Repository layout

```text
apps/web                 Next.js public Wiki, admin, and HTTP API
packages/api-contracts   API primitives shared with clients
packages/domain          framework-independent domain rules
packages/validation      schemas for untrusted inputs
plugins/obsidian-wiki    Obsidian publishing bridge
docker-compose.yml       PostgreSQL and MinIO development services
docs/                    implementation decisions and delivery plan
```

## Prerequisites

- Node.js 20.9 or newer (the repository uses Node LTS through `mise`)
- pnpm 12 or newer
- Docker Compose, for PostgreSQL and MinIO

## Local setup

1. Copy `.env.example` to `.env` and replace every placeholder secret.
2. Install workspace dependencies: `pnpm install`.
3. Start local infrastructure: `docker compose up -d`.
4. Start the web application: `pnpm dev`.
5. Open `http://localhost:3000`.

The MinIO console is available at `http://localhost:9001`; it is for local
development only. Its credentials come from `.env` and must never be committed.
`POSTGRES_PORT` is the host port for PostgreSQL (default example: `5433`), so it
does not collide with an existing local PostgreSQL instance on port `5432`.

## Commands

| Command           | Purpose                                          |
| ----------------- | ------------------------------------------------ |
| `pnpm dev`        | Run the Next.js application in development mode. |
| `pnpm dev:plugin` | Watch and bundle the Obsidian plugin.            |
| `pnpm build`      | Build all workspace packages.                    |
| `pnpm lint`       | Run static checks.                               |
| `pnpm typecheck`  | Run TypeScript checks.                           |
| `pnpm test`       | Run the test suites.                             |
| `pnpm format`     | Format source files with Prettier.               |

## Obsidian plugin development

Run `pnpm dev:plugin`, then copy or symlink this directory into the target
Vault's `.obsidian/plugins/wikly-publisher` directory. Obsidian loads
`manifest.json` and the generated `main.js`. Do not copy credentials into the
plugin source; device credentials will be provisioned in Phase 3.

## Current scope

Phase 0 is complete: workspace scaffolding, service definitions, web and plugin
stubs, formatting/linting/typecheck/test commands, and environment guidance are
in place. The detailed roadmap and architecture assumptions live in
[`docs/implementation-plan.md`](docs/implementation-plan.md).
