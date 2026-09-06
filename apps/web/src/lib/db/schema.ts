import { relations } from 'drizzle-orm'
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}
const id = () => uuid('id').defaultRandom().primaryKey()

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  ...timestamps,
})
export const sites = pgTable('sites', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ...timestamps,
})
export const pages = pgTable(
  'pages',
  {
    id: id(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id),
    sourceId: text('source_id').notNull(),
    path: text('path').notNull(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    markdown: text('markdown').notNull(),
    frontmatter: jsonb('frontmatter_json').notNull(),
    status: text('status').notNull(),
    contentHash: text('content_hash').notNull(),
    revision: integer('revision').notNull().default(1),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique().on(t.siteId, t.sourceId),
    unique().on(t.siteId, t.slug),
    index('pages_status_idx').on(t.status),
    index('pages_source_id_idx').on(t.sourceId),
  ],
)
export const pageRevisions = pgTable(
  'page_revisions',
  {
    id: id(),
    pageId: uuid('page_id')
      .notNull()
      .references(() => pages.id),
    revision: integer('revision').notNull(),
    markdown: text('markdown').notNull(),
    frontmatter: jsonb('frontmatter_json').notNull(),
    contentHash: text('content_hash').notNull(),
    sourcePath: text('source_path').notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [unique().on(t.pageId, t.revision)],
)
export const assets = pgTable(
  'assets',
  {
    id: id(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id),
    hash: text('hash').notNull(),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    storageKey: text('storage_key').notNull(),
    orphanedAt: timestamp('orphaned_at', { withTimezone: true }),
    createdAt: timestamps.createdAt,
  },
  (t) => [unique().on(t.siteId, t.hash)],
)
export const pageAssets = pgTable(
  'page_assets',
  {
    pageId: uuid('page_id')
      .notNull()
      .references(() => pages.id),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id),
    sourcePath: text('source_path').notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [primaryKey({ columns: [t.pageId, t.assetId] })],
)
export const pageLinks = pgTable(
  'page_links',
  {
    sourcePageId: uuid('source_page_id')
      .notNull()
      .references(() => pages.id),
    targetPageId: uuid('target_page_id')
      .notNull()
      .references(() => pages.id),
    linkText: text('link_text'),
    createdAt: timestamps.createdAt,
  },
  (t) => [primaryKey({ columns: [t.sourcePageId, t.targetPageId] })],
)
export const tags = pgTable(
  'tags',
  {
    id: id(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [unique().on(t.siteId, t.slug)],
)
export const pageTags = pgTable(
  'page_tags',
  {
    pageId: uuid('page_id')
      .notNull()
      .references(() => pages.id),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id),
  },
  (t) => [primaryKey({ columns: [t.pageId, t.tagId] })],
)
export const pendingChanges = pgTable('pending_changes', {
  id: id(),
  siteId: uuid('site_id')
    .notNull()
    .references(() => sites.id),
  sourceId: text('source_id').notNull(),
  operation: text('operation').notNull(),
  payload: jsonb('payload_json').notNull(),
  status: text('status').notNull().default('pending'),
  leaseId: text('lease_id'),
  leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
  attemptCount: integer('attempt_count').notNull().default(0),
  lastError: text('last_error'),
  createdAt: timestamps.createdAt,
  claimedAt: timestamp('claimed_at', { withTimezone: true }),
  appliedAt: timestamp('applied_at', { withTimezone: true }),
})
export const devices = pgTable('devices', {
  id: id(),
  siteId: uuid('site_id')
    .notNull()
    .references(() => sites.id),
  name: text('name').notNull(),
  tokenHash: text('token_hash').notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  createdAt: timestamps.createdAt,
})
export const sitePages = relations(sites, ({ many }) => ({
  pages: many(pages),
}))
export const pageRelations = relations(pages, ({ one, many }) => ({
  site: one(sites, { fields: [pages.siteId], references: [sites.id] }),
  revisions: many(pageRevisions),
}))
