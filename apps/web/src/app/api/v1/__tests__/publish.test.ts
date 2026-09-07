import { describe, expect, it } from 'vitest'
import { computeContentHash } from '@wikly/domain'
import { POST as authDevicePost } from '../auth/device/route'
import { POST as publishPost } from '../publish/route'
import { createSite } from '@/lib/db/repos/sites'
import { createPendingDevice, revokeDevice } from '@/lib/db/repos/devices'

describe('API v1: Auth & Publishing', () => {
  const uniqueId = Date.now().toString()

  it('rejects unauthenticated publish requests', async () => {
    const req = new Request('http://localhost:3000/api/v1/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const res = await publishPost(req)
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.success).toBe(false)
  })

  it('pairs device with one-time code, burns code, and performs publishing flow', async () => {
    // 1. Create a test site
    const site = await createSite({
      name: 'Publish Test Site',
      slug: `publish-site-${uniqueId}`,
    })

    // 2. Admin creates a pending device -> gets a one-time pairing code
    const { deviceId, pairingCode, name } = await createPendingDevice(
      site.id,
      'Test Device MacBook',
    )
    expect(deviceId).toBeDefined()
    expect(pairingCode).toMatch(/^WIK-[A-F0-9]{6}$/)
    expect(name).toBe('Test Device MacBook')

    // 3. Reject invalid pairing code
    const invalidReq = new Request('http://localhost:3000/api/v1/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: site.id,
        pairingCode: 'WIK-WRONG1',
      }),
    })
    const invalidRes = await authDevicePost(invalidReq)
    expect(invalidRes.status).toBe(401)

    // 4. Plugin pairs device via POST /api/v1/auth/device with valid code
    const authReq = new Request('http://localhost:3000/api/v1/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: site.id,
        pairingCode,
      }),
    })

    const authRes = await authDevicePost(authReq)
    expect(authRes.status).toBe(200)
    const authData = await authRes.json()
    expect(authData.success).toBe(true)
    expect(authData.deviceId).toBe(deviceId)
    expect(authData.name).toBe('Test Device MacBook')
    expect(authData.token).toBeDefined()
    expect(authData.status).toBe('approved')

    const deviceToken = authData.token

    // 5. Pairing code is burned (one-time use) -> second attempt must fail
    const authRetryRes = await authDevicePost(authReq)
    expect(authRetryRes.status).toBe(401)

    // 6. Publish a new note with approved device
    const sourceId = `01TEST${uniqueId.slice(-10)}`
    const md1 = '# Initial Title\n\nSome body text with [[Target Note]].'
    const fm1 = {
      title: 'Initial Title',
      tags: ['test', 'dev'],
      wiki: { id: sourceId, published: true },
    }
    const hash1 = computeContentHash(md1, fm1)

    const pubReq1 = new Request('http://localhost:3000/api/v1/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deviceToken}`,
      },
      body: JSON.stringify({
        siteId: site.id,
        sourceId,
        path: 'Docs/Initial Title.md',
        title: 'Initial Title',
        slug: 'initial-title',
        markdown: md1,
        frontmatter: fm1,
        contentHash: hash1,
      }),
    })

    const pubRes1 = await publishPost(pubReq1)
    expect(pubRes1.status).toBe(200)
    const pubData1 = await pubRes1.json()
    expect(pubData1.success).toBe(true)
    expect(pubData1.changed).toBe(true)
    expect(pubData1.page.revision).toBe(1)
    expect(pubData1.page.sourceId).toBe(sourceId)

    // 7. Duplicate publish with exact same hash -> idempotent (changed: false, revision stays 1)
    const pubReq2 = new Request('http://localhost:3000/api/v1/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deviceToken}`,
      },
      body: JSON.stringify({
        siteId: site.id,
        sourceId,
        path: 'Docs/Initial Title.md',
        title: 'Initial Title',
        slug: 'initial-title',
        markdown: md1,
        frontmatter: fm1,
        contentHash: hash1,
      }),
    })

    const pubRes2 = await publishPost(pubReq2)
    expect(pubRes2.status).toBe(200)
    const pubData2 = await pubRes2.json()
    expect(pubData2.success).toBe(true)
    expect(pubData2.changed).toBe(false)
    expect(pubData2.page.revision).toBe(1)

    // 8. Incremental publish with updated content -> revision bumps to 2
    const md2 = '# Updated Title\n\nUpdated body.'
    const fm2 = { ...fm1, title: 'Updated Title' }
    const hash2 = computeContentHash(md2, fm2)

    const pubReq3 = new Request('http://localhost:3000/api/v1/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deviceToken}`,
      },
      body: JSON.stringify({
        siteId: site.id,
        sourceId,
        path: 'Docs/Updated Title.md',
        title: 'Updated Title',
        slug: 'updated-title',
        markdown: md2,
        frontmatter: fm2,
        contentHash: hash2,
        serverRevision: 1,
      }),
    })

    const pubRes3 = await publishPost(pubReq3)
    expect(pubRes3.status).toBe(200)
    const pubData3 = await pubRes3.json()
    expect(pubData3.success).toBe(true)
    expect(pubData3.changed).toBe(true)
    expect(pubData3.page.revision).toBe(2)

    // 9. Concurrency conflict with stale serverRevision
    const pubReqConflict = new Request('http://localhost:3000/api/v1/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deviceToken}`,
      },
      body: JSON.stringify({
        siteId: site.id,
        sourceId,
        path: 'Docs/Updated Title.md',
        title: 'Conflicting Title',
        slug: 'updated-title',
        markdown: '# Another edit',
        frontmatter: fm2,
        contentHash: computeContentHash('# Another edit', fm2),
        serverRevision: 1, // Stale! Current revision is 2
      }),
    })

    const pubResConflict = await publishPost(pubReqConflict)
    expect(pubResConflict.status).toBe(409)

    // 10. Revoke device -> subsequent publish must be rejected (401)
    await revokeDevice(deviceId)
    const pubReqRevoked = new Request('http://localhost:3000/api/v1/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deviceToken}`,
      },
      body: JSON.stringify({
        siteId: site.id,
        sourceId,
        path: 'Docs/Updated Title.md',
        title: 'Updated Title',
        slug: 'updated-title',
        markdown: md2,
        frontmatter: fm2,
        contentHash: hash2,
        serverRevision: 2,
      }),
    })
    const pubResRevoked = await publishPost(pubReqRevoked)
    expect(pubResRevoked.status).toBe(401)
  })
})
