import { extractAliases, slugify } from '@wikly/domain'
import type {
  GraphDataDto,
  GraphLinkDto,
  GraphNodeDto,
} from '@wikly/api-contracts'
import { and, desc, eq, ilike, inArray, or } from 'drizzle-orm'
import { db } from '../client'
import { pageLinks, pageRevisions, pages, pageTags, tags } from '../schema'

import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

export type Page = InferSelectModel<typeof pages>
export type InsertPage = InferInsertModel<typeof pages>

export interface PageWithTags extends Page {
  tags: Array<{ id: string; name: string; slug: string }>
}

export interface BacklinkItem {
  id: string
  title: string
  slug: string
  linkText: string | null
}

export interface PageResolutionResult {
  page: PageWithTags
  isAlias: boolean
  canonicalSlug: string
}

export interface RelatedPageItem {
  id: string
  title: string
  slug: string
  sharedTags: string[]
  updatedAt: Date
}

export async function createPage(page: InsertPage): Promise<Page> {
  const [created] = await db.insert(pages).values(page).returning()
  return created
}

export async function getPageById(id: string): Promise<Page | null> {
  const [page] = await db.select().from(pages).where(eq(pages.id, id))
  return page ?? null
}

export async function getPageBySlug(
  siteId: string,
  slug: string,
): Promise<Page | null> {
  const [page] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.slug, slug)))
  return page ?? null
}

export async function getPublishedPageBySlug(
  siteId: string,
  slug: string,
): Promise<PageWithTags | null> {
  const [page] = await db
    .select()
    .from(pages)
    .where(
      and(
        eq(pages.siteId, siteId),
        eq(pages.slug, slug),
        eq(pages.status, 'published'),
      ),
    )

  if (!page) return null

  // Fetch tags for this page
  const pageTagRows = await db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
    })
    .from(pageTags)
    .innerJoin(tags, eq(pageTags.tagId, tags.id))
    .where(eq(pageTags.pageId, page.id))

  return {
    ...page,
    tags: pageTagRows,
  }
}

export async function getPublishedPages(
  siteId: string,
  limit = 50,
): Promise<Page[]> {
  return db
    .select()
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.status, 'published')))
    .orderBy(desc(pages.updatedAt))
    .limit(limit)
}

export async function getPageBacklinks(
  pageId: string,
): Promise<BacklinkItem[]> {
  return db
    .select({
      id: pages.id,
      title: pages.title,
      slug: pages.slug,
      linkText: pageLinks.linkText,
    })
    .from(pageLinks)
    .innerJoin(pages, eq(pageLinks.sourcePageId, pages.id))
    .where(
      and(eq(pageLinks.targetPageId, pageId), eq(pages.status, 'published')),
    )
}

export async function searchPages(
  siteId: string,
  query: string,
): Promise<Page[]> {
  if (!query.trim()) return []
  const pattern = `%${query.trim()}%`

  return db
    .select()
    .from(pages)
    .where(
      and(
        eq(pages.siteId, siteId),
        eq(pages.status, 'published'),
        or(ilike(pages.title, pattern), ilike(pages.markdown, pattern)),
      ),
    )
    .orderBy(desc(pages.updatedAt))
    .limit(25)
}

export type PageRevision = typeof pageRevisions.$inferSelect

export interface AdminPageListItem extends PageWithTags {
  revisionCount: number
}

export async function getAllPagesAdmin(
  siteId: string,
  options?: {
    search?: string
    status?: string
    limit?: number
    offset?: number
  },
): Promise<AdminPageListItem[]> {
  const limit = options?.limit ?? 100
  const offset = options?.offset ?? 0

  const conditions = [eq(pages.siteId, siteId)]

  if (options?.status && options.status !== 'all') {
    conditions.push(eq(pages.status, options.status))
  }

  if (options?.search && options.search.trim()) {
    const pattern = `%${options.search.trim()}%`
    conditions.push(
      or(
        ilike(pages.title, pattern),
        ilike(pages.path, pattern),
        ilike(pages.slug, pattern),
      )!,
    )
  }

  const rows = await db
    .select()
    .from(pages)
    .where(and(...conditions))
    .orderBy(desc(pages.updatedAt))
    .limit(limit)
    .offset(offset)

  if (rows.length === 0) return []

  const pageIds = rows.map((r) => r.id)

  // Fetch tags for all these pages
  const tagRows = await db
    .select({
      pageId: pageTags.pageId,
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
    })
    .from(pageTags)
    .innerJoin(tags, eq(pageTags.tagId, tags.id))

  const tagsByPage = new Map<
    string,
    Array<{ id: string; name: string; slug: string }>
  >()
  for (const tr of tagRows) {
    if (!tagsByPage.has(tr.pageId)) {
      tagsByPage.set(tr.pageId, [])
    }
    tagsByPage.get(tr.pageId)!.push({ id: tr.id, name: tr.name, slug: tr.slug })
  }

  return rows.map((p) => ({
    ...p,
    tags: tagsByPage.get(p.id) || [],
    revisionCount: p.revision,
  }))
}

export async function getPageWithRevisions(pageId: string): Promise<{
  page: PageWithTags | null
  revisions: PageRevision[]
}> {
  const [page] = await db.select().from(pages).where(eq(pages.id, pageId))
  if (!page) {
    return { page: null, revisions: [] }
  }

  const pageTagRows = await db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
    })
    .from(pageTags)
    .innerJoin(tags, eq(pageTags.tagId, tags.id))
    .where(eq(pageTags.pageId, page.id))

  const revs = await db
    .select()
    .from(pageRevisions)
    .where(eq(pageRevisions.pageId, pageId))
    .orderBy(desc(pageRevisions.revision))

  return {
    page: {
      ...page,
      tags: pageTagRows,
    },
    revisions: revs,
  }
}

export async function getPublishedPageBySlugOrAlias(
  siteId: string,
  slugOrAlias: string,
): Promise<PageResolutionResult | null> {
  // 1. Direct canonical slug match
  const directPage = await getPublishedPageBySlug(siteId, slugOrAlias)
  if (directPage) {
    return {
      page: directPage,
      isAlias: false,
      canonicalSlug: directPage.slug,
    }
  }

  // 2. Check frontmatter aliases
  const targetNorm = slugify(slugOrAlias)
  const allPublished = await db
    .select({
      id: pages.id,
      slug: pages.slug,
      frontmatter: pages.frontmatter,
    })
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.status, 'published')))

  for (const item of allPublished) {
    const aliases = extractAliases(item.frontmatter as Record<string, unknown>)
    const isMatch = aliases.some(
      (a) =>
        slugify(a) === targetNorm ||
        a.toLowerCase() === slugOrAlias.toLowerCase(),
    )
    if (isMatch) {
      const fullPage = await getPublishedPageBySlug(siteId, item.slug)
      if (fullPage) {
        return {
          page: fullPage,
          isAlias: true,
          canonicalSlug: fullPage.slug,
        }
      }
    }
  }

  return null
}

export async function getRelatedPages(
  siteId: string,
  pageId: string,
  limit = 4,
): Promise<RelatedPageItem[]> {
  // 1. Tags on this page
  const pageTagRows = await db
    .select({ id: tags.id, name: tags.name })
    .from(pageTags)
    .innerJoin(tags, eq(pageTags.tagId, tags.id))
    .where(eq(pageTags.pageId, pageId))

  const currentTagIds = new Set(pageTagRows.map((t) => t.id))
  const currentTagMap = new Map(pageTagRows.map((t) => [t.id, t.name]))

  // 2. Direct link connections
  const connectedIds = new Set<string>()
  const linksOut = await db
    .select({ target: pageLinks.targetPageId })
    .from(pageLinks)
    .where(eq(pageLinks.sourcePageId, pageId))
  const linksIn = await db
    .select({ source: pageLinks.sourcePageId })
    .from(pageLinks)
    .where(eq(pageLinks.targetPageId, pageId))

  for (const l of linksOut) connectedIds.add(l.target)
  for (const l of linksIn) connectedIds.add(l.source)

  // 3. Candidate published pages
  const otherPages = await db
    .select({
      id: pages.id,
      title: pages.title,
      slug: pages.slug,
      updatedAt: pages.updatedAt,
    })
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.status, 'published')))

  const candidatePages = otherPages.filter((p) => p.id !== pageId)
  if (candidatePages.length === 0) return []

  // 4. Fetch tag associations for all candidate pages
  const candidateIds = candidatePages.map((p) => p.id)
  const candidateTagRows = await db
    .select({
      pageId: pageTags.pageId,
      tagId: pageTags.tagId,
    })
    .from(pageTags)
    .where(inArray(pageTags.pageId, candidateIds))

  const candidateTagsMap = new Map<string, string[]>()
  for (const row of candidateTagRows) {
    if (currentTagIds.has(row.tagId)) {
      const tagName = currentTagMap.get(row.tagId)
      if (tagName) {
        const list = candidateTagsMap.get(row.pageId) || []
        list.push(tagName)
        candidateTagsMap.set(row.pageId, list)
      }
    }
  }

  // 5. Score candidates
  const scored = candidatePages
    .map((p) => {
      const sharedTags = candidateTagsMap.get(p.id) || []
      const isConnected = connectedIds.has(p.id)
      const score = sharedTags.length * 2 + (isConnected ? 1 : 0)
      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        sharedTags,
        updatedAt: p.updatedAt,
        score,
      }
    })
    .filter((p) => p.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return b.updatedAt.getTime() - a.updatedAt.getTime()
    })

  if (scored.length > 0) {
    return scored.slice(0, limit)
  }

  // Fallback if no tags/links overlap: return recent other pages
  return candidatePages
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      sharedTags: [],
      updatedAt: p.updatedAt,
    }))
}

export async function getGraphData(
  siteId: string,
  options?: { pageSlug?: string; depth?: number },
): Promise<GraphDataDto> {
  const publishedPages = await db
    .select({
      id: pages.id,
      slug: pages.slug,
      title: pages.title,
    })
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.status, 'published')))

  const pageIdMap = new Map(publishedPages.map((p) => [p.id, p]))
  const pageIds = Array.from(pageIdMap.keys())

  if (pageIds.length === 0) {
    return { nodes: [], links: [] }
  }

  // Fetch all links between published pages
  const allLinks = await db
    .select({
      sourcePageId: pageLinks.sourcePageId,
      targetPageId: pageLinks.targetPageId,
    })
    .from(pageLinks)
    .where(
      and(
        inArray(pageLinks.sourcePageId, pageIds),
        inArray(pageLinks.targetPageId, pageIds),
      ),
    )

  // Filter if neighborhood requested
  let relevantNodeIds = new Set<string>(pageIds)
  let rootPageId: string | undefined

  if (options?.pageSlug) {
    const rootPage = publishedPages.find((p) => p.slug === options.pageSlug)
    if (rootPage) {
      rootPageId = rootPage.id
      const neighborhood = new Set<string>([rootPage.id])
      const depth = options.depth ?? 1

      for (let d = 0; d < depth; d++) {
        const currentBatch = Array.from(neighborhood)
        for (const link of allLinks) {
          if (currentBatch.includes(link.sourcePageId)) {
            neighborhood.add(link.targetPageId)
          }
          if (currentBatch.includes(link.targetPageId)) {
            neighborhood.add(link.sourcePageId)
          }
        }
      }
      relevantNodeIds = neighborhood
    }
  }

  const filteredLinks: GraphLinkDto[] = allLinks
    .filter(
      (l) =>
        relevantNodeIds.has(l.sourcePageId) &&
        relevantNodeIds.has(l.targetPageId),
    )
    .map((l) => ({
      source: l.sourcePageId,
      target: l.targetPageId,
    }))

  // Count degree per node
  const degreeMap = new Map<string, number>()
  for (const l of filteredLinks) {
    degreeMap.set(l.source, (degreeMap.get(l.source) || 0) + 1)
    degreeMap.set(l.target, (degreeMap.get(l.target) || 0) + 1)
  }

  const nodes: GraphNodeDto[] = publishedPages
    .filter((p) => relevantNodeIds.has(p.id))
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      isCurrent: rootPageId ? p.id === rootPageId : false,
      linkCount: degreeMap.get(p.id) || 0,
    }))

  return {
    nodes,
    links: filteredLinks,
  }
}
