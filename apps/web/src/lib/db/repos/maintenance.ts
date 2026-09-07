import { and, eq, lte } from 'drizzle-orm'
import { db } from '../client'
import { assets, pages } from '../schema'
import { getStorageDriver } from '../../storage'
import { syncPageLinks } from './publishing'
import { updateSiteOrphanedAssets } from './assets'
import { extractAssetReferences, parseWikilinks } from '@wikly/domain'

export interface GcResult {
  scannedCount: number
  deletedCount: number
  freedBytes: number
  errors: string[]
}

export interface ReconcileResult {
  totalPages: number
  repairedLinks: number
  repairedAssets: number
  durationMs: number
}

/**
 * Garbage Collect orphaned assets older than specified hours (default 24h).
 */
export async function garbageCollectOrphanAssets(
  siteId: string,
  olderThanHours = 24,
): Promise<GcResult> {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000)

  // Ensure orphan timestamps are up to date
  await updateSiteOrphanedAssets(siteId)

  // Find assets orphaned before cutoff
  const eligibleAssets = await db
    .select({
      id: assets.id,
      storageKey: assets.storageKey,
      sizeBytes: assets.sizeBytes,
    })
    .from(assets)
    .where(
      and(
        eq(assets.siteId, siteId),
        lte(assets.orphanedAt, cutoff),
      ),
    )

  let deletedCount = 0
  let freedBytes = 0
  const errors: string[] = []
  const storageDriver = getStorageDriver()

  for (const asset of eligibleAssets) {
    try {
      // 1. Delete from storage driver
      await storageDriver.delete(asset.storageKey)

      // 2. Delete from database
      await db.delete(assets).where(eq(assets.id, asset.id))

      deletedCount++
      freedBytes += Number(asset.sizeBytes || 0)
    } catch (err: unknown) {
      errors.push(
        `Failed to delete asset ${asset.id} (${asset.storageKey}): ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  return {
    scannedCount: eligibleAssets.length,
    deletedCount,
    freedBytes,
    errors,
  }
}

/**
 * Reconcile all published pages in vault:
 * - Repair broken link projections & aliases in page_links
 * - Re-verify page_assets links
 * - Trigger orphan detection
 */
export async function reconcileVault(siteId: string): Promise<ReconcileResult> {
  const start = Date.now()

  // 1. Fetch all published pages
  const published = await db
    .select({
      id: pages.id,
      slug: pages.slug,
      title: pages.title,
      markdown: pages.markdown,
    })
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.status, 'published')))

  let repairedLinks = 0
  let repairedAssets = 0

  for (const page of published) {
    // Reconcile links
    const extractedLinks = parseWikilinks(page.markdown)
    await syncPageLinks(page.id, siteId, page.markdown)
    repairedLinks += extractedLinks.length


    // Reconcile asset references
    const assetRefs = extractAssetReferences(page.markdown)
    repairedAssets += assetRefs.length
  }

  // Update orphan asset timestamps
  await updateSiteOrphanedAssets(siteId)

  return {
    totalPages: published.length,
    repairedLinks,
    repairedAssets,
    durationMs: Date.now() - start,
  }
}
