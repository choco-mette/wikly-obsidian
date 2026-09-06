import { and, count, desc, eq } from 'drizzle-orm'
import { db } from '../client'
import { pages, pageTags, tags } from '../schema'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import type { Page } from './pages'

export type Tag = InferSelectModel<typeof tags>
export type InsertTag = InferInsertModel<typeof tags>

export interface TagWithCount {
  id: string
  name: string
  slug: string
  count: number
}

export async function createTag(tag: InsertTag): Promise<Tag> {
  const [created] = await db.insert(tags).values(tag).returning()
  return created
}

export async function getAllTagsWithCount(
  siteId: string,
): Promise<TagWithCount[]> {
  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      count: count(pageTags.pageId),
    })
    .from(tags)
    .leftJoin(pageTags, eq(tags.id, pageTags.tagId))
    .leftJoin(
      pages,
      and(eq(pageTags.pageId, pages.id), eq(pages.status, 'published')),
    )
    .where(eq(tags.siteId, siteId))
    .groupBy(tags.id, tags.name, tags.slug)
    .orderBy(desc(count(pageTags.pageId)), tags.name)

  return rows.map((row) => ({
    ...row,
    count: Number(row.count),
  }))
}

export async function getPagesByTagSlug(
  siteId: string,
  tagSlug: string,
): Promise<{ tag: Tag | null; pages: Page[] }> {
  const [tag] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.siteId, siteId), eq(tags.slug, tagSlug)))

  if (!tag) {
    return { tag: null, pages: [] }
  }

  const tagPages = await db
    .select({
      id: pages.id,
      siteId: pages.siteId,
      sourceId: pages.sourceId,
      path: pages.path,
      title: pages.title,
      slug: pages.slug,
      markdown: pages.markdown,
      frontmatter: pages.frontmatter,
      status: pages.status,
      contentHash: pages.contentHash,
      revision: pages.revision,
      publishedAt: pages.publishedAt,
      createdAt: pages.createdAt,
      updatedAt: pages.updatedAt,
    })
    .from(pages)
    .innerJoin(pageTags, eq(pages.id, pageTags.pageId))
    .where(and(eq(pageTags.tagId, tag.id), eq(pages.status, 'published')))
    .orderBy(desc(pages.updatedAt))

  return {
    tag,
    pages: tagPages,
  }
}
