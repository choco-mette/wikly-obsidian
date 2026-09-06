# Wikly implementation plan

## Architecture decisions

- Obsidian Vault remains the single source of truth. PostgreSQL stores only the published projection.
- The plugin is the only component that reads or writes Vault files. Admin write-back is modelled as a claimed, leased pending change.
- Runtime packages are separated into the Next.js application, Obsidian plugin, and framework-independent contracts/domain/validation packages.
- Assets have immutable SHA-256 identities. Storage drivers are selected server-side, never by the plugin.
- Normal publishing is event-driven and incremental; a Vault-wide scan is reserved for explicit reconciliation.

## Delivery sequence

1. **Phase 0 — bootstrap (current):** workspace, web and plugin scaffolds, quality tooling, Docker Compose, environment documentation.
2. **Phase 1:** shared contracts/domain primitives, Drizzle schema, migrations, repositories, and database tests.
3. **Phase 2:** public rendering, page/tag/search routes, and safe Markdown pipeline.
4. **Phases 3–4:** authenticated plugin publishing and asset pipeline.
5. **Phases 5–6:** admin panel and controlled frontmatter write-back.
6. **Phases 7–8:** advanced Obsidian rendering, graph/Excalidraw, operational hardening.

## Assumptions to validate before Phase 1

- Initial deployment is a single-site deployment, while all table keys preserve `siteId` for future multi-site support.
- PostgreSQL full-text search is sufficient for MVP.
- Local filesystem storage and MinIO development support are both retained; S3 compatibility will use the same server-side driver interface.
- The first authentication implementation will use scoped device credentials plus a separate admin session boundary.
