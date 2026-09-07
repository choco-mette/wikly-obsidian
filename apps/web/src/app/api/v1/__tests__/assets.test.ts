import { describe, expect, it } from 'vitest'
import { computeBinaryHash, computeContentHash } from '@wikly/domain'
import { POST as checkPost } from '../assets/check/route'
import { POST as presignPost } from '../assets/presign/route'
import { POST as uploadPost } from '../assets/upload/route'
import { GET as rawGet } from '../assets/raw/[...key]/route'
import { POST as publishPost } from '../publish/route'
import { POST as authDevicePost } from '../auth/device/route'
import { createSite } from '@/lib/db/repos/sites'
import { createPendingDevice } from '@/lib/db/repos/devices'
import { assetsRepo } from '@/lib/db'

describe('API v1: Assets Pipeline', () => {
  const uniqueId = Date.now().toString()

  it('handles asset check, presign, upload, serving, dedupe, and orphan lifecycle', async () => {
    // 1. Create site and pair device
    const site = await createSite({
      name: 'Asset Test Site',
      slug: `asset-site-${uniqueId}`,
    })

    const { pairingCode } = await createPendingDevice(site.id, 'Asset Tester')
    const authReq = new Request('http://localhost:3000/api/v1/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId: site.id, pairingCode }),
    })
    const authRes = await authDevicePost(authReq)
    const { token } = await authRes.json()

    // 2. Binary asset preparation
    const fileContent = Buffer.from('fake png image content ' + uniqueId)
    const fileHash = computeBinaryHash(fileContent)
    const fileName = 'diagram.png'

    // 3. Check non-existent asset
    const checkReq1 = new Request('http://localhost:3000/api/v1/assets/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        siteId: site.id,
        assets: [{ path: `attachments/${fileName}`, hash: fileHash }],
      }),
    })
    const checkRes1 = await checkPost(checkReq1)
    expect(checkRes1.status).toBe(200)
    const checkData1 = await checkRes1.json()
    expect(checkData1.success).toBe(true)
    expect(checkData1.results[0].exists).toBe(false)

    // 4. Presign upload
    const presignReq = new Request(
      'http://localhost:3000/api/v1/assets/presign',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          siteId: site.id,
          filename: fileName,
          hash: fileHash,
          sizeBytes: fileContent.length,
          mimeType: 'image/png',
        }),
      },
    )
    const presignRes = await presignPost(presignReq)
    expect(presignRes.status).toBe(200)
    const presignData = await presignRes.json()
    expect(presignData.success).toBe(true)
    expect(presignData.uploadUrl).toBeDefined()
    expect(presignData.assetId).toBeDefined()

    // 5. Upload asset via POST /api/v1/assets/upload
    const uploadUrl = new URL('http://localhost:3000/api/v1/assets/upload')
    uploadUrl.searchParams.set('siteId', site.id)
    uploadUrl.searchParams.set('hash', fileHash)
    uploadUrl.searchParams.set('filename', fileName)
    uploadUrl.searchParams.set('mimeType', 'image/png')

    const uploadReq = new Request(uploadUrl.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'image/png',
      },
      body: fileContent,
    })
    const uploadRes = await uploadPost(uploadReq)
    expect(uploadRes.status).toBe(200)
    const uploadData = await uploadRes.json()
    expect(uploadData.success).toBe(true)
    expect(uploadData.storageKey).toBeDefined()

    // 6. Check existing asset (deduplication check)
    const checkReq2 = new Request('http://localhost:3000/api/v1/assets/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        siteId: site.id,
        assets: [{ path: `attachments/${fileName}`, hash: fileHash }],
      }),
    })
    const checkRes2 = await checkPost(checkReq2)
    const checkData2 = await checkRes2.json()
    expect(checkData2.results[0].exists).toBe(true)
    expect(checkData2.results[0].url).toBeDefined()

    // 7. Access asset BEFORE page publish -> Must be private / 403
    const storageKeyParts = uploadData.storageKey.split('/')
    const rawReq1 = new Request(
      `http://localhost:3000/api/v1/assets/raw/${uploadData.storageKey}`,
    )
    const rawRes1 = await rawGet(rawReq1, {
      params: Promise.resolve({ key: storageKeyParts }),
    })
    expect(rawRes1.status).toBe(403) // Not referenced by published page yet

    // 8. Publish page referencing this asset
    const md = `# Architecture\n\n![[attachments/${fileName}]]`
    const fm = { wiki: { published: true } }
    const contentHash = computeContentHash(md, fm)

    const publishReq = new Request('http://localhost:3000/api/v1/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        siteId: site.id,
        sourceId: '01ASSETTESTPAGE0000000000',
        path: 'Architecture.md',
        title: 'Architecture',
        slug: 'architecture',
        markdown: md,
        frontmatter: fm,
        contentHash,
        assets: [
          {
            path: `attachments/${fileName}`,
            hash: fileHash,
          },
        ],
      }),
    })
    const publishRes = await publishPost(publishReq)
    expect(publishRes.status).toBe(200)

    // 9. Access asset AFTER page publish -> 200 OK with proper headers
    const rawRes2 = await rawGet(rawReq1, {
      params: Promise.resolve({ key: storageKeyParts }),
    })
    expect(rawRes2.status).toBe(200)
    expect(rawRes2.headers.get('Content-Type')).toBe('image/png')
    expect(rawRes2.headers.get('Cache-Control')).toContain('public')
    const rawBytes = await rawRes2.arrayBuffer()
    expect(Buffer.from(rawBytes)).toEqual(fileContent)

    // 10. Republish page WITHOUT this asset reference -> Asset becomes orphaned
    const md2 = `# Architecture\n\nNo image here anymore.`
    const contentHash2 = computeContentHash(md2, fm)

    const publishReq2 = new Request('http://localhost:3000/api/v1/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        siteId: site.id,
        sourceId: '01ASSETTESTPAGE0000000000',
        path: 'Architecture.md',
        title: 'Architecture',
        slug: 'architecture',
        markdown: md2,
        frontmatter: fm,
        contentHash: contentHash2,
        serverRevision: 1,
        assets: [],
      }),
    })
    const publishRes2 = await publishPost(publishReq2)
    expect(publishRes2.status).toBe(200)

    // Asset still exists in db but orphanedAt is now set
    const assetRecord = await assetsRepo.findAssetByHash(site.id, fileHash)
    expect(assetRecord).not.toBeNull()
    expect(assetRecord?.orphanedAt).not.toBeNull()

    // And raw access becomes 403 again
    const rawRes3 = await rawGet(rawReq1, {
      params: Promise.resolve({ key: storageKeyParts }),
    })
    expect(rawRes3.status).toBe(403)
  })
})
