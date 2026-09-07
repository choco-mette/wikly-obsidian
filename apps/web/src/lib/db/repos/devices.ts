import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import { db } from '../client'
import { devices, sites } from '../schema'

export function hashValue(val: string): string {
  return createHash('sha256').update(val).digest('hex')
}

export function generateDeviceToken(): string {
  return `wikly_dev_${randomBytes(24).toString('hex')}`
}

export function generatePairingCode(): string {
  return `WIK-${randomBytes(3).toString('hex').toUpperCase()}`
}

/**
 * Admin action: Pre-authorize a new device by name, generating a temporary one-time pairing code.
 */
export async function createPendingDevice(
  siteId: string,
  name: string,
  expiresInMinutes = 15,
): Promise<{
  deviceId: string
  name: string
  pairingCode: string
  expiresAt: Date
}> {
  const [site] = await db
    .select({ id: sites.id })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1)

  if (!site) {
    throw new Error(`Site with id ${siteId} does not exist`)
  }

  const pairingCode = generatePairingCode()
  const pairingCodeHash = hashValue(pairingCode)
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000)

  const [device] = await db
    .insert(devices)
    .values({
      siteId,
      name,
      pairingCodeHash,
      pairingCodeExpiresAt: expiresAt,
      status: 'pending',
    })
    .returning({ id: devices.id, name: devices.name })

  return {
    deviceId: device.id,
    name: device.name,
    pairingCode,
    expiresAt,
  }
}

/**
 * Obsidian Plugin action: Submit one-time pairing code to claim a permanent token and activate the device.
 */
export async function pairDevice(
  siteId: string,
  pairingCode: string,
): Promise<{ deviceId: string; name: string; token: string }> {
  const pairingCodeHash = hashValue(pairingCode.trim().toUpperCase())
  const now = new Date()

  const [device] = await db
    .select({
      id: devices.id,
      name: devices.name,
      status: devices.status,
    })
    .from(devices)
    .where(
      and(
        eq(devices.siteId, siteId),
        eq(devices.pairingCodeHash, pairingCodeHash),
        eq(devices.status, 'pending'),
        gt(devices.pairingCodeExpiresAt, now),
      ),
    )
    .limit(1)

  if (!device) {
    throw new Error('Invalid or expired pairing code')
  }

  const token = generateDeviceToken()
  const tokenHash = hashValue(token)

  // Activate device, store token hash, burn pairing code
  await db
    .update(devices)
    .set({
      tokenHash,
      pairingCodeHash: null,
      pairingCodeExpiresAt: null,
      status: 'approved',
      approvedAt: now,
      lastSeenAt: now,
    })
    .where(eq(devices.id, device.id))

  return {
    deviceId: device.id,
    name: device.name,
    token,
  }
}

/**
 * Verify device bearer token for API requests. Must have status === 'approved'.
 */
export async function validateDeviceToken(
  siteId: string,
  token: string,
): Promise<{ id: string; siteId: string; name: string } | null> {
  const tokenHash = hashValue(token)

  const [device] = await db
    .select({
      id: devices.id,
      siteId: devices.siteId,
      name: devices.name,
      status: devices.status,
    })
    .from(devices)
    .where(
      and(
        eq(devices.siteId, siteId),
        eq(devices.tokenHash, tokenHash),
        eq(devices.status, 'approved'),
      ),
    )
    .limit(1)

  if (!device) {
    return null
  }

  await db
    .update(devices)
    .set({ lastSeenAt: new Date() })
    .where(eq(devices.id, device.id))

  return {
    id: device.id,
    siteId: device.siteId,
    name: device.name,
  }
}

/**
 * Verify device bearer token without requiring siteId beforehand.
 */
export async function findApprovedDeviceByToken(
  token: string,
): Promise<{ id: string; siteId: string; name: string } | null> {
  const tokenHash = hashValue(token)

  const [device] = await db
    .select({
      id: devices.id,
      siteId: devices.siteId,
      name: devices.name,
      status: devices.status,
    })
    .from(devices)
    .where(
      and(eq(devices.tokenHash, tokenHash), eq(devices.status, 'approved')),
    )
    .limit(1)

  if (!device) {
    return null
  }

  await db
    .update(devices)
    .set({ lastSeenAt: new Date() })
    .where(eq(devices.id, device.id))

  return {
    id: device.id,
    siteId: device.siteId,
    name: device.name,
  }
}

/**
 * Admin action: Revoke active device token.
 */
export async function revokeDevice(deviceId: string): Promise<void> {
  await db
    .update(devices)
    .set({ status: 'revoked', tokenHash: null })
    .where(eq(devices.id, deviceId))
}

export type DeviceRecord = typeof devices.$inferSelect

/**
 * Admin action: Get all devices for a site, optionally filtered by status.
 */
export async function getDevicesBySite(
  siteId: string,
  status?: string,
): Promise<DeviceRecord[]> {
  if (status && status !== 'all') {
    return db
      .select()
      .from(devices)
      .where(and(eq(devices.siteId, siteId), eq(devices.status, status)))
      .orderBy(devices.createdAt)
  }

  return db
    .select()
    .from(devices)
    .where(eq(devices.siteId, siteId))
    .orderBy(devices.createdAt)
}

/**
 * Admin action: Re-generate pairing code for a device.
 */
export async function regeneratePairingCode(
  deviceId: string,
  expiresInMinutes = 15,
): Promise<{ pairingCode: string; expiresAt: Date }> {
  const pairingCode = generatePairingCode()
  const pairingCodeHash = hashValue(pairingCode)
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000)

  await db
    .update(devices)
    .set({
      pairingCodeHash,
      pairingCodeExpiresAt: expiresAt,
      tokenHash: null,
      status: 'pending',
    })
    .where(eq(devices.id, deviceId))

  return {
    pairingCode,
    expiresAt,
  }
}
