import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '../client'
import { assets, devices, pages, pendingChanges, tags } from '../schema'

export interface DashboardStats {
  publishedPagesCount: number
  draftPagesCount: number
  tagsCount: number
  assetsCount: number
  orphanedAssetsCount: number
  pendingChangesCount: number
  activeDevicesCount: number
  recentPages: Array<{
    id: string
    title: string
    slug: string
    status: string
    revision: number
    updatedAt: Date
  }>
  recentPendingChanges: Array<{
    id: string
    sourceId: string
    operation: string
    status: string
    createdAt: Date
  }>
}

export async function getDashboardStats(
  siteId: string,
): Promise<DashboardStats> {
  const [pagesCount] = await db
    .select({
      published: sql<number>`count(*) filter (where ${pages.status} = 'published')`,
      draft: sql<number>`count(*) filter (where ${pages.status} != 'published')`,
    })
    .from(pages)
    .where(eq(pages.siteId, siteId))

  const [tagsCountRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tags)
    .where(eq(tags.siteId, siteId))

  const [assetsCountRow] = await db
    .select({
      total: sql<number>`count(*)`,
      orphaned: sql<number>`count(*) filter (where ${assets.orphanedAt} is not null)`,
    })
    .from(assets)
    .where(eq(assets.siteId, siteId))

  const [pendingChangesCountRow] = await db
    .select({
      count: sql<number>`count(*) filter (where ${pendingChanges.status} = 'pending')`,
    })
    .from(pendingChanges)
    .where(eq(pendingChanges.siteId, siteId))

  const [devicesCountRow] = await db
    .select({
      count: sql<number>`count(*) filter (where ${devices.status} = 'approved')`,
    })
    .from(devices)
    .where(eq(devices.siteId, siteId))

  const recentPages = await db
    .select({
      id: pages.id,
      title: pages.title,
      slug: pages.slug,
      status: pages.status,
      revision: pages.revision,
      updatedAt: pages.updatedAt,
    })
    .from(pages)
    .where(eq(pages.siteId, siteId))
    .orderBy(desc(pages.updatedAt))
    .limit(5)

  const recentPending = await db
    .select({
      id: pendingChanges.id,
      sourceId: pendingChanges.sourceId,
      operation: pendingChanges.operation,
      status: pendingChanges.status,
      createdAt: pendingChanges.createdAt,
    })
    .from(pendingChanges)
    .where(eq(pendingChanges.siteId, siteId))
    .orderBy(desc(pendingChanges.createdAt))
    .limit(5)

  return {
    publishedPagesCount: Number(pagesCount?.published || 0),
    draftPagesCount: Number(pagesCount?.draft || 0),
    tagsCount: Number(tagsCountRow?.count || 0),
    assetsCount: Number(assetsCountRow?.total || 0),
    orphanedAssetsCount: Number(assetsCountRow?.orphaned || 0),
    pendingChangesCount: Number(pendingChangesCountRow?.count || 0),
    activeDevicesCount: Number(devicesCountRow?.count || 0),
    recentPages,
    recentPendingChanges: recentPending,
  }
}
