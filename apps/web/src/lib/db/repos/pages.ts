import { and, desc, eq, ilike, or } from 'drizzle-orm'
import { db } from '../client'
import { pageLinks, pages, pageTags, tags } from '../schema'
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
