import { describe, expect, it } from 'vitest'
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from '@/lib/auth/session'
import { DELETE as authDelete, POST as authPost } from '../auth/route'
import { POST as devicesPost } from '../devices/route'
import { POST as deviceAuthPost } from '../../v1/auth/device/route'
import { POST as publishPost } from '../../v1/publish/route'
import { createSite } from '@/lib/db/repos/sites'
import { getUserByEmail } from '@/lib/db/repos/users'
import { devicesRepo } from '@/lib/db'

describe('Admin API & Authentication', () => {
  it('manages admin session tokens correctly', () => {
    const user = { id: 'admin-123', email: 'admin@wikly.local' }
    const token = createSessionToken(user)
    expect(token).toBeDefined()

    const verified = verifySessionToken(token)
    expect(verified).not.toBeNull()
    expect(verified?.id).toBe(user.id)
    expect(verified?.email).toBe(user.email)

    // Tampered token fails
    const tampered = token.slice(0, -5) + 'abcde'
    expect(verifySessionToken(tampered)).toBeNull()

    // Invalid format fails
    expect(verifySessionToken('invalid-base64-random')).toBeNull()
  })

  it('authenticates admin credentials via POST /api/admin/auth and handles logout', async () => {
    // 1. Missing credentials
    const req1 = new Request('http://localhost:3000/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '', password: '' }),
    })
    const res1 = await authPost(req1)
    expect(res1.status).toBe(400)

    // 2. Wrong password
    const req2 = new Request('http://localhost:3000/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@wikly.local',
        password: 'wrongpassword',
      }),
    })
    const res2 = await authPost(req2)
    expect(res2.status).toBe(401)

    // 3. Valid credentials
    const req3 = new Request('http://localhost:3000/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@wikly.local',
        password: 'password123',
      }),
    })
    const res3 = await authPost(req3)
    expect(res3.status).toBe(200)
    const data3 = await res3.json()
    expect(data3.success).toBe(true)
    expect(data3.user.email).toBe('admin@wikly.local')

    // 4. Logout via DELETE
    const res4 = await authDelete()
    expect(res4.status).toBe(200)
    const data4 = await res4.json()
    expect(data4.success).toBe(true)
  })

  it('manages device creation, pairing, revocation, and code regeneration', async () => {
    const site = await createSite({
      name: 'Admin Test Site',
      slug: `admin-site-${Date.now()}`,
    })

    const adminUser = await getUserByEmail('admin@wikly.local')
    const sessionToken = createSessionToken({
      id: adminUser?.id || 'admin-id',
      email: 'admin@wikly.local',
    })

    // 1. Unauthorized request (no session cookie)
    const reqUnauth = new Request('http://localhost:3000/api/admin/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', siteId: site.id, name: 'iPad' }),
    })
    const resUnauth = await devicesPost(reqUnauth)
    expect(resUnauth.status).toBe(401)

    // 2. Authorized create device
    const reqCreate = new Request('http://localhost:3000/api/admin/devices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
      },
      body: JSON.stringify({
        action: 'create',
        siteId: site.id,
        name: 'Work MacBook',
      }),
    })
    const resCreate = await devicesPost(reqCreate)
    expect(resCreate.status).toBe(200)
    const dataCreate = await resCreate.json()
    expect(dataCreate.success).toBe(true)
    expect(dataCreate.device.name).toBe('Work MacBook')
    expect(dataCreate.device.pairingCode).toMatch(/^WIK-[A-F0-9]{6}$/)

    const deviceId = dataCreate.device.deviceId
    const pairingCode = dataCreate.device.pairingCode

    // 3. Plugin pairs device via POST /api/v1/auth/device
    const reqPair = new Request('http://localhost:3000/api/v1/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: site.id,
        pairingCode,
      }),
    })
    const resPair = await deviceAuthPost(reqPair)
    expect(resPair.status).toBe(200)
    const dataPair = await resPair.json()
    expect(dataPair.success).toBe(true)
    expect(dataPair.token).toBeDefined()
    const deviceToken = dataPair.token

    // 4. Publish note with active device token -> succeeds
    const reqPublish = new Request('http://localhost:3000/api/v1/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deviceToken}`,
      },
      body: JSON.stringify({
        siteId: site.id,
        sourceId: '01TESTADMINGENPAGE0000000',
        path: 'Test.md',
        title: 'Admin Test Page',
        slug: 'admin-test-page',
        markdown: '# Test',
        frontmatter: {},
        contentHash:
          'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      }),
    })
    const resPublish = await publishPost(reqPublish)
    expect(resPublish.status).toBe(200)

    // 5. Admin revokes device
    const reqRevoke = new Request('http://localhost:3000/api/admin/devices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
      },
      body: JSON.stringify({
        action: 'revoke',
        deviceId,
      }),
    })
    const resRevoke = await devicesPost(reqRevoke)
    expect(resRevoke.status).toBe(200)

    // 6. Publishing after revocation -> rejected (401)
    const reqPublish2 = new Request('http://localhost:3000/api/v1/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deviceToken}`,
      },
      body: JSON.stringify({
        siteId: site.id,
        sourceId: '01TESTADMINGENPAGE0000000',
        path: 'Test.md',
        title: 'Admin Test Page',
        slug: 'admin-test-page',
        markdown: '# Test modified',
        frontmatter: {},
        contentHash:
          'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b856',
      }),
    })
    const resPublish2 = await publishPost(reqPublish2)
    expect(resPublish2.status).toBe(401)

    // 7. Admin regenerates pairing code for revoked device
    const reqRegen = new Request('http://localhost:3000/api/admin/devices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
      },
      body: JSON.stringify({
        action: 'regenerate',
        deviceId,
      }),
    })
    const resRegen = await devicesPost(reqRegen)
    expect(resRegen.status).toBe(200)
    const dataRegen = await resRegen.json()
    expect(dataRegen.pairingCode).toMatch(/^WIK-[A-F0-9]{6}$/)
    expect(dataRegen.pairingCode).not.toBe(pairingCode)
  })
})
