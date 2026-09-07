import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { db } from '../client'
import { assets, pageAssets, pages } from '../schema'

export interface AssetRecord {
  id: string
  siteId: string
  hash: string
  filename: string
  mimeType: string
  sizeBytes: number
  storageKey: string
  orphanedAt: Date | null
  createdAt: Date
}

export interface CreateAssetInput {
  siteId: string
  hash: string
  filename: string
  mimeType: string
  sizeBytes: number
  storageKey: string
}

export async function findAssetByHash(
  siteId: string,
  hash: string,
): Promise<AssetRecord | null> {
  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.siteId, siteId), eq(assets.hash, hash)))
    .limit(1)

  return asset || null
}

export async function findAssetsByHashes(
  siteId: string,
  hashes: string[],
): Promise<AssetRecord[]> {
  if (hashes.length === 0) return []

  return db
    .select()
    .from(assets)
    .where(and(eq(assets.siteId, siteId), inArray(assets.hash, hashes)))
}

export async function createOrUpdateAsset(
  input: CreateAssetInput,
): Promise<AssetRecord> {
  const [record] = await db
    .insert(assets)
    .values({
      siteId: input.siteId,
      hash: input.hash,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storageKey: input.storageKey,
      orphanedAt: null,
    })
    .onConflictDoUpdate({
      target: [assets.siteId, assets.hash],
      set: {
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        storageKey: input.storageKey,
        orphanedAt: null,
      },
    })
    .returning()

  return record
}

export async function syncPageAssets(
  pageId: string,
  siteId: string,
  assetItems: { path: string; hash: string }[],
): Promise<void> {
  if (assetItems.length === 0) {
    // Delete all page assets for this page
    await db.delete(pageAssets).where(eq(pageAssets.pageId, pageId))
    await updateSiteOrphanedAssets(siteId)
    return
  }

  // Find all assets by hash
  const hashes = assetItems.map((a) => a.hash)
  const matchedAssets = await findAssetsByHashes(siteId, hashes)
  const hashMap = new Map(matchedAssets.map((a) => [a.hash, a]))

  const newAssetIds: string[] = []

  for (const item of assetItems) {
    const asset = hashMap.get(item.hash)
    if (!asset) continue

    newAssetIds.push(asset.id)

    await db
      .insert(pageAssets)
      .values({
        pageId,
        assetId: asset.id,
        sourcePath: item.path,
      })
      .onConflictDoNothing()
  }

  // Remove unreferenced assets for this page
  if (newAssetIds.length > 0) {
    await db
      .delete(pageAssets)
      .where(
        and(
          eq(pageAssets.pageId, pageId),
          sql`${pageAssets.assetId} NOT IN ${newAssetIds}`,
        ),
      )
  } else {
    await db.delete(pageAssets).where(eq(pageAssets.pageId, pageId))
  }

  // Re-activate active assets (un-orphan)
  if (newAssetIds.length > 0) {
    await db
      .update(assets)
      .set({ orphanedAt: null })
      .where(and(eq(assets.siteId, siteId), inArray(assets.id, newAssetIds)))
  }

  // Update orphaned assets
  await updateSiteOrphanedAssets(siteId)
}

/**
 * Mark assets as orphaned if they have no links in page_assets.
 */
export async function updateSiteOrphanedAssets(siteId: string): Promise<void> {
  await db.execute(sql`
    UPDATE assets
    SET orphaned_at = NOW()
    WHERE site_id = ${siteId}
      AND orphaned_at IS NULL
      AND id NOT IN (
        SELECT DISTINCT asset_id FROM page_assets
      )
  `)
}

/**
 * Check if an asset is public (linked to at least one published page).
 */
export async function isAssetPublic(assetId: string): Promise<boolean> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(pageAssets)
    .innerJoin(pages, eq(pageAssets.pageId, pages.id))
    .where(and(eq(pageAssets.assetId, assetId), eq(pages.status, 'published')))

  return Number(result?.count || 0) > 0
}

/**
 * Get map of { [sourcePath | filename]: publicUrl } for a published page.
 */
export async function getPageAssetMap(
  pageId: string,
): Promise<Record<string, string>> {
  const records = await db
    .select({
      sourcePath: pageAssets.sourcePath,
      filename: assets.filename,
      storageKey: assets.storageKey,
    })
    .from(pageAssets)
    .innerJoin(assets, eq(pageAssets.assetId, assets.id))
    .where(eq(pageAssets.pageId, pageId))

  // Dynamically import or invoke getStorageDriver
  const { getStorageDriver } = await import('../../storage')
  const storageDriver = getStorageDriver()
  const map: Record<string, string> = {}

  for (const r of records) {
    const url = storageDriver.getPublicUrl(r.storageKey)
    map[r.sourcePath] = url
    map[r.filename] = url
    const simpleName = r.sourcePath.split('/').pop()
    if (simpleName) {
      map[simpleName] = url
    }
  }

  return map
}

/**
 * Find asset by storage key.
 */
export async function findAssetByStorageKey(
  storageKey: string,
): Promise<AssetRecord | null> {
  const [asset] = await db
    .select()
    .from(assets)
    .where(eq(assets.storageKey, storageKey))
    .limit(1)

  return asset || null
}

export interface AdminAssetItem extends AssetRecord {
  referencedPagesCount: number
  publicUrl: string
}

export async function getAllAssetsAdmin(
  siteId: string,
  options?: {
    orphanedOnly?: boolean
    search?: string
  },
): Promise<AdminAssetItem[]> {
  const conditions = [eq(assets.siteId, siteId)]

  if (options?.orphanedOnly) {
    conditions.push(sql`${assets.orphanedAt} IS NOT NULL`)
  }

  if (options?.search && options.search.trim()) {
    const pattern = `%${options.search.trim()}%`
    conditions.push(
      or(ilike(assets.filename, pattern), ilike(assets.hash, pattern))!,
    )
  }

  const rows = await db
    .select({
      id: assets.id,
      siteId: assets.siteId,
      hash: assets.hash,
      filename: assets.filename,
      mimeType: assets.mimeType,
      sizeBytes: assets.sizeBytes,
      storageKey: assets.storageKey,
      orphanedAt: assets.orphanedAt,
      createdAt: assets.createdAt,
      refCount: sql<number>`count(${pageAssets.pageId})`,
    })
    .from(assets)
    .leftJoin(pageAssets, eq(assets.id, pageAssets.assetId))
    .where(and(...conditions))
    .groupBy(assets.id)
    .orderBy(desc(assets.createdAt))

  const { getStorageDriver } = await import('../../storage')
  const storageDriver = getStorageDriver()

  return rows.map((r) => ({
    ...r,
    referencedPagesCount: Number(r.refCount || 0),
    publicUrl: storageDriver.getPublicUrl(r.storageKey),
  }))
}
