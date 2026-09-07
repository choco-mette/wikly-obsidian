import { extractAliases, parseWikilinks, slugify } from '@wikly/domain'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../client'
import { pageLinks, pageRevisions, pages, pageTags, tags } from '../schema'
import { syncPageAssets } from './assets'

export class RevisionConflictError extends Error {
  constructor(
    public clientRevision: number,
    public serverRevision: number,
  ) {
    super(
      `Revision conflict: client revision ${clientRevision} does not match server revision ${serverRevision}`,
    )
    this.name = 'RevisionConflictError'
  }
}

export interface PublishPagePayload {
  siteId: string
  sourceId: string
  path: string
  title: string
  slug: string
  markdown: string
  frontmatter: Record<string, unknown>
  contentHash: string
  serverRevision?: number
  assets?: { path: string; hash: string }[]
}

export interface PublishResult {
  changed: boolean
  page: {
    id: string
    sourceId: string
    revision: number
    slug: string
  }
  contentHash: string
}

export async function publishPage(
  payload: PublishPagePayload,
): Promise<PublishResult> {
  const { siteId, sourceId } = payload

  // 1. Check if page exists by (siteId, sourceId)
  const [existing] = await db
    .select({
      id: pages.id,
      sourceId: pages.sourceId,
      revision: pages.revision,
      slug: pages.slug,
      contentHash: pages.contentHash,
      status: pages.status,
    })
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.sourceId, sourceId)))
    .limit(1)

  if (existing) {
    // Check if content hash is identical
    if (
      existing.contentHash === payload.contentHash &&
      existing.status === 'published'
    ) {
      return {
        changed: false,
        page: {
          id: existing.id,
          sourceId: existing.sourceId,
          revision: existing.revision,
          slug: existing.slug,
        },
        contentHash: existing.contentHash,
      }
    }

    // Check optimistic concurrency
    if (
      typeof payload.serverRevision === 'number' &&
      payload.serverRevision !== existing.revision
    ) {
      throw new RevisionConflictError(payload.serverRevision, existing.revision)
    }

    const newRevision = existing.revision + 1

    await db
      .update(pages)
      .set({
        path: payload.path,
        title: payload.title,
        slug: payload.slug,
        markdown: payload.markdown,
        frontmatter: payload.frontmatter,
        contentHash: payload.contentHash,
        revision: newRevision,
        status: 'published',
        updatedAt: new Date(),
      })
      .where(eq(pages.id, existing.id))

    await db.insert(pageRevisions).values({
      pageId: existing.id,
      revision: newRevision,
      markdown: payload.markdown,
      frontmatter: payload.frontmatter,
      contentHash: payload.contentHash,
      sourcePath: payload.path,
    })

    await syncPageTags(existing.id, siteId, payload.frontmatter)
    await syncPageLinks(existing.id, siteId, payload.markdown)
    await syncPageAssets(existing.id, siteId, payload.assets || [])

    return {
      changed: true,
      page: {
        id: existing.id,
        sourceId: existing.sourceId,
        revision: newRevision,
        slug: payload.slug,
      },
      contentHash: payload.contentHash,
    }
  }

  // 2. New page creation
  // Resolve potential slug collision
  let resolvedSlug = payload.slug
  const [slugConflict] = await db
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.slug, resolvedSlug)))
    .limit(1)

  if (slugConflict) {
    resolvedSlug = `${resolvedSlug}-${sourceId.slice(-6).toLowerCase()}`
  }

  const [created] = await db
    .insert(pages)
    .values({
      siteId,
      sourceId,
      path: payload.path,
      title: payload.title,
      slug: resolvedSlug,
      markdown: payload.markdown,
      frontmatter: payload.frontmatter,
      contentHash: payload.contentHash,
      revision: 1,
      status: 'published',
      publishedAt: new Date(),
    })
    .returning({
      id: pages.id,
      sourceId: pages.sourceId,
      revision: pages.revision,
      slug: pages.slug,
    })

  await db.insert(pageRevisions).values({
    pageId: created.id,
    revision: 1,
    markdown: payload.markdown,
    frontmatter: payload.frontmatter,
    contentHash: payload.contentHash,
    sourcePath: payload.path,
  })

  await syncPageTags(created.id, siteId, payload.frontmatter)
  await syncPageLinks(created.id, siteId, payload.markdown)
  await syncPageAssets(created.id, siteId, payload.assets || [])

  return {
    changed: true,
    page: created,
    contentHash: payload.contentHash,
  }
}

async function syncPageTags(
  pageId: string,
  siteId: string,
  frontmatter: Record<string, unknown>,
): Promise<void> {
  // Remove existing tags
  await db.delete(pageTags).where(eq(pageTags.pageId, pageId))

  const rawTags = frontmatter.tags
  const tagList: string[] = []
  if (Array.isArray(rawTags)) {
    for (const t of rawTags) {
      if (typeof t === 'string' && t.trim()) {
        tagList.push(t.trim())
      }
    }
  }

  if (tagList.length === 0) return

  for (const tagName of tagList) {
    const tagSlug = slugify(tagName)
    // Find or create tag
    let [tag] = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.siteId, siteId), eq(tags.slug, tagSlug)))
      .limit(1)

    if (!tag) {
      const [newTag] = await db
        .insert(tags)
        .values({
          siteId,
          name: tagName,
          slug: tagSlug,
        })
        .onConflictDoNothing()
        .returning({ id: tags.id })

      tag = newTag
      if (!tag) {
        // In case of race condition conflict
        const [existingTag] = await db
          .select({ id: tags.id })
          .from(tags)
          .where(and(eq(tags.siteId, siteId), eq(tags.slug, tagSlug)))
          .limit(1)
        tag = existingTag
      }
    }

    if (tag) {
      await db
        .insert(pageTags)
        .values({ pageId, tagId: tag.id })
        .onConflictDoNothing()
    }
  }
}

export async function syncPageLinks(
  sourcePageId: string,
  siteId: string,
  markdown: string,
): Promise<void> {
  await db.delete(pageLinks).where(eq(pageLinks.sourcePageId, sourcePageId))

  const linkTargets = parseWikilinks(markdown)
  if (linkTargets.length === 0) return

  const targetSlugs = linkTargets.map((t) => slugify(t))

  // 1. Direct slug matches
  const matchedPages = await db
    .select({ id: pages.id, slug: pages.slug, title: pages.title })
    .from(pages)
    .where(and(eq(pages.siteId, siteId), inArray(pages.slug, targetSlugs)))

  const linkedIds = new Set(matchedPages.map((p) => p.id))
  const matchedSlugs = new Set(matchedPages.map((p) => p.slug))

  // 2. Check unmatched targets against frontmatter aliases
  const unmatchedTargets = linkTargets.filter(
    (t) => !matchedSlugs.has(slugify(t)),
  )

  if (unmatchedTargets.length > 0) {
    const allPublished = await db
      .select({
        id: pages.id,
        slug: pages.slug,
        title: pages.title,
        frontmatter: pages.frontmatter,
      })
      .from(pages)
      .where(and(eq(pages.siteId, siteId), eq(pages.status, 'published')))

    for (const target of unmatchedTargets) {
      const targetNorm = slugify(target)
      for (const p of allPublished) {
        const aliases = extractAliases(p.frontmatter as Record<string, unknown>)
        if (
          aliases.some(
            (a) =>
              slugify(a) === targetNorm ||
              a.toLowerCase() === target.toLowerCase(),
          )
        ) {
          if (!linkedIds.has(p.id)) {
            matchedPages.push({ id: p.id, slug: p.slug, title: p.title })
            linkedIds.add(p.id)
          }
          break
        }
      }
    }
  }

  for (const target of matchedPages) {
    if (target.id !== sourcePageId) {
      await db
        .insert(pageLinks)
        .values({
          sourcePageId,
          targetPageId: target.id,
          linkText: target.title,
        })
        .onConflictDoNothing()
    }
  }
}
