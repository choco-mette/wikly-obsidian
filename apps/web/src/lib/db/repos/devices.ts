import { createHash, randomBytes } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '../client'
import { devices, sites } from '../schema'

export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function generateDeviceToken(): string {
  return `wikly_dev_${randomBytes(24).toString('hex')}`
}

export async function registerDevice(
  siteId: string,
  name: string,
): Promise<{ deviceId: string; token: string }> {
  // Check if site exists
  const [site] = await db
    .select({ id: sites.id })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1)

  if (!site) {
    throw new Error(`Site with id ${siteId} does not exist`)
  }

  const token = generateDeviceToken()
  const tokenHash = hashDeviceToken(token)

  const [device] = await db
    .insert(devices)
    .values({
      siteId,
      name,
      tokenHash,
      lastSeenAt: new Date(),
    })
    .returning({ id: devices.id })

  return {
    deviceId: device.id,
    token,
  }
}

export async function validateDeviceToken(
  siteId: string,
  token: string,
): Promise<{ id: string; siteId: string; name: string } | null> {
  const tokenHash = hashDeviceToken(token)

  const [device] = await db
    .select({
      id: devices.id,
      siteId: devices.siteId,
      name: devices.name,
    })
    .from(devices)
    .where(and(eq(devices.siteId, siteId), eq(devices.tokenHash, tokenHash)))
    .limit(1)

  if (!device) {
    return null
  }

  await db
    .update(devices)
    .set({ lastSeenAt: new Date() })
    .where(eq(devices.id, device.id))

  return device
}
