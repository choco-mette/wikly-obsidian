import { describe, expect, it } from 'vitest'
import { createSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session'
import { createSite } from '@/lib/db/repos/sites'
import { devicesRepo } from '@/lib/db'
import { type SyncChangeItem } from '@wikly/api-contracts'
import { GET as syncChangesGet } from '../sync/changes/route'
import { POST as syncClaimPost } from '../sync/changes/[id]/claim/route'
import { POST as syncAckPost } from '../sync/changes/[id]/ack/route'
import { POST as adminPendingChangesPost } from '../../admin/pending-changes/route'
import { POST as adminRetryPost } from '../../admin/pending-changes/[id]/retry/route'

describe('Sync & Write-Back API', () => {
  it('handles the full write-back lifecycle: query, claim, ack, failure, and retry', async () => {
    const site = await createSite({
      name: 'WriteBack Test Site',
      slug: `sync-site-${Date.now()}`,
    })

    const adminSessionToken = createSessionToken({
      id: 'admin-123',
      email: 'admin@wikly.local',
    })

    // Create and pair a test device
    const pendingDevice = await devicesRepo.createPendingDevice(
      site.id,
      'Sync Laptop',
    )
    const paired = await devicesRepo.pairDevice(
      site.id,
      pendingDevice.pairingCode,
    )
    const deviceToken = paired.token

    // 1. Unauthorized query (no token) -> 401
    const reqUnauth = new Request('http://localhost:3000/api/v1/sync/changes', {
      method: 'GET',
    })
    const resUnauth = await syncChangesGet(reqUnauth)
    expect(resUnauth.status).toBe(401)

    // 2. Query with valid device token -> empty list initially
    const reqAuth = new Request('http://localhost:3000/api/v1/sync/changes', {
      method: 'GET',
      headers: { Authorization: `Bearer ${deviceToken}` },
    })
    const resAuth = await syncChangesGet(reqAuth)
    expect(resAuth.status).toBe(200)
    const dataAuth = await resAuth.json()
    expect(dataAuth.success).toBe(true)
    expect(dataAuth.changes.length).toBe(0)

    // 3. Admin dispatches a pending change via POST /api/admin/pending-changes
    const reqCreate = new Request(
      'http://localhost:3000/api/admin/pending-changes',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${SESSION_COOKIE_NAME}=${adminSessionToken}`,
        },
        body: JSON.stringify({
          siteId: site.id,
          sourceId: '01TESTWRITEBACK0000000000',
          operation: 'frontmatter.patch',
          baseRevision: 3,
          patch: {
            tags: { add: ['cisco', 'network'], remove: ['draft'] },
            properties: { set: { 'wiki.published': true } },
          },
        }),
      },
    )
    const resCreate = await adminPendingChangesPost(reqCreate)
    expect(resCreate.status).toBe(200)
    const dataCreate = await resCreate.json()
    expect(dataCreate.success).toBe(true)
    const changeId = dataCreate.change.id

    // 4. Device polls sync changes again -> receives change
    const resPoll = await syncChangesGet(reqAuth)
    expect(resPoll.status).toBe(200)
    const dataPoll = await resPoll.json()
    expect(dataPoll.changes.length).toBeGreaterThanOrEqual(1)
    const foundChange = dataPoll.changes.find(
      (c: SyncChangeItem) => c.sourceId === '01TESTWRITEBACK0000000000',
    )
    expect(foundChange).toBeDefined()
    expect(foundChange.id).toBe(changeId)
    expect(foundChange.patch.tags.add).toEqual(['cisco', 'network'])

    // 5. Device claims the change
    const reqClaim = new Request(
      `http://localhost:3000/api/v1/sync/changes/${changeId}/claim`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${deviceToken}` },
      },
    )
    const resClaim = await syncClaimPost(reqClaim, {
      params: Promise.resolve({ id: changeId }),
    })
    expect(resClaim.status).toBe(200)
    const dataClaim = await resClaim.json()
    expect(dataClaim.success).toBe(true)
    expect(dataClaim.leaseId).toBeDefined()
    const leaseId = dataClaim.leaseId

    // 6. Second claim while active -> rejected (409)
    const resClaim2 = await syncClaimPost(reqClaim, {
      params: Promise.resolve({ id: changeId }),
    })
    expect(resClaim2.status).toBe(409)

    // 7. ACK with wrong leaseId -> rejected (409)
    const reqAckWrong = new Request(
      `http://localhost:3000/api/v1/sync/changes/${changeId}/ack`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deviceToken}`,
        },
        body: JSON.stringify({
          success: true,
          leaseId: 'wrong-lease-id',
        }),
      },
    )
    const resAckWrong = await syncAckPost(reqAckWrong, {
      params: Promise.resolve({ id: changeId }),
    })
    expect(resAckWrong.status).toBe(409)

    // 8. ACK with valid leaseId and success = true -> status becomes applied
    const reqAckValid = new Request(
      `http://localhost:3000/api/v1/sync/changes/${changeId}/ack`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deviceToken}`,
        },
        body: JSON.stringify({
          success: true,
          leaseId,
          result: {
            sourceId: '01TESTWRITEBACK0000000000',
            contentHash:
              'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          },
        }),
      },
    )
    const resAckValid = await syncAckPost(reqAckValid, {
      params: Promise.resolve({ id: changeId }),
    })
    expect(resAckValid.status).toBe(200)
    const dataAckValid = await resAckValid.json()
    expect(dataAckValid.status).toBe('applied')

    // 9. Failure flow: create another change, claim, and report failure
    const reqCreateFail = new Request(
      'http://localhost:3000/api/admin/pending-changes',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${SESSION_COOKIE_NAME}=${adminSessionToken}`,
        },
        body: JSON.stringify({
          siteId: site.id,
          sourceId: '01TESTFAILLOCALNOTE0000000',
          operation: 'frontmatter.patch',
          patch: { tags: { add: ['broken'] } },
        }),
      },
    )
    const resCreateFail = await adminPendingChangesPost(reqCreateFail)
    const dataCreateFail = await resCreateFail.json()
    const failChangeId = dataCreateFail.change.id

    // Claim fail change
    const reqClaimFail = new Request(
      `http://localhost:3000/api/v1/sync/changes/${failChangeId}/claim`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${deviceToken}` },
      },
    )
    const resClaimFail = await syncClaimPost(reqClaimFail, {
      params: Promise.resolve({ id: failChangeId }),
    })
    const dataClaimFail = await resClaimFail.json()
    const failLeaseId = dataClaimFail.leaseId

    // Report failure
    const reqAckFail = new Request(
      `http://localhost:3000/api/v1/sync/changes/${failChangeId}/ack`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deviceToken}`,
        },
        body: JSON.stringify({
          success: false,
          leaseId: failLeaseId,
          errorCode: 'FILE_NOT_FOUND',
          message: 'Note with sourceId not found in local vault',
        }),
      },
    )
    const resAckFail = await syncAckPost(reqAckFail, {
      params: Promise.resolve({ id: failChangeId }),
    })
    expect(resAckFail.status).toBe(200)
    const dataAckFail = await resAckFail.json()
    expect(dataAckFail.status).toBe('failed')

    // 10. Admin retries the failed change
    const reqRetry = new Request(
      `http://localhost:3000/api/admin/pending-changes/${failChangeId}/retry`,
      {
        method: 'POST',
        headers: {
          Cookie: `${SESSION_COOKIE_NAME}=${adminSessionToken}`,
        },
      },
    )
    const resRetry = await adminRetryPost(reqRetry, {
      params: Promise.resolve({ id: failChangeId }),
    })
    expect(resRetry.status).toBe(200)
    const dataRetry = await resRetry.json()
    expect(dataRetry.success).toBe(true)
  })
})
