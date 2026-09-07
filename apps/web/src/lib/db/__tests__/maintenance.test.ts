import { describe, it, expect, beforeAll } from 'vitest'
import { maintenanceRepo, sitesRepo, pagesRepo } from '../index'

describe('Maintenance: Reconcile & Garbage Collection', () => {
  let siteId: string

  beforeAll(async () => {
    const site = await sitesRepo.getSiteBySlug('default')
    if (!site) throw new Error('Default site not found')
    siteId = site.id
  })

  it('runs reconcileVault without errors and returns summary', async () => {
    const result = await maintenanceRepo.reconcileVault(siteId)

    expect(typeof result.totalPages).toBe('number')
    expect(typeof result.repairedLinks).toBe('number')
    expect(typeof result.repairedAssets).toBe('number')
    expect(typeof result.durationMs).toBe('number')
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('runs garbageCollectOrphanAssets cleanly', async () => {
    const result = await maintenanceRepo.garbageCollectOrphanAssets(siteId, 0)

    expect(typeof result.scannedCount).toBe('number')
    expect(typeof result.deletedCount).toBe('number')
    expect(typeof result.freedBytes).toBe('number')
    expect(Array.isArray(result.errors)).toBe(true)
    expect(result.errors.length).toBe(0)
  })
})
