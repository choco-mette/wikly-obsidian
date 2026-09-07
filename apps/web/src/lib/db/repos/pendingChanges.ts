import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, gt, lt, or, sql } from 'drizzle-orm'
import { db } from '../client'
import { pendingChanges } from '../schema'

export type PendingChangeRecord = typeof pendingChanges.$inferSelect

export async function getPendingChanges(
  siteId: string,
  statusFilter?: string,
): Promise<PendingChangeRecord[]> {
  const conditions = [eq(pendingChanges.siteId, siteId)]

  if (statusFilter && statusFilter !== 'all') {
    conditions.push(eq(pendingChanges.status, statusFilter))
  }

  return db
    .select()
    .from(pendingChanges)
    .where(and(...conditions))
    .orderBy(desc(pendingChanges.createdAt))
}

export async function getSyncChanges(
  siteId: string,
  cursor?: string,
  limit = 50,
): Promise<PendingChangeRecord[]> {
  const now = new Date()
  const conditions = [
    eq(pendingChanges.siteId, siteId),
    or(
      eq(pendingChanges.status, 'pending'),
      and(
        eq(pendingChanges.status, 'claimed'),
        lt(pendingChanges.leaseExpiresAt, now),
      ),
    ),
  ]

  if (cursor) {
    conditions.push(gt(pendingChanges.id, cursor))
  }

  return db
    .select()
    .from(pendingChanges)
    .where(and(...conditions))
    .orderBy(asc(pendingChanges.id))
    .limit(limit)
}

export async function claimChange(
  changeId: string,
  siteId: string,
  leaseDurationMs = 5 * 60 * 1000,
): Promise<{ leaseId: string; leaseExpiresAt: Date } | null> {
  const now = new Date()
  const leaseId = randomUUID()
  const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs)

  const [updated] = await db
    .update(pendingChanges)
    .set({
      status: 'claimed',
      leaseId,
      leaseExpiresAt,
      claimedAt: now,
      attemptCount: sql`${pendingChanges.attemptCount} + 1`,
    })
    .where(
      and(
        eq(pendingChanges.id, changeId),
        eq(pendingChanges.siteId, siteId),
        or(
          eq(pendingChanges.status, 'pending'),
          and(
            eq(pendingChanges.status, 'claimed'),
            lt(pendingChanges.leaseExpiresAt, now),
          ),
        ),
      ),
    )
    .returning()

  if (!updated) {
    return null
  }

  return { leaseId, leaseExpiresAt }
}

export async function ackChange(
  changeId: string,
  siteId: string,
  leaseId: string,
  success: boolean,
  error?: string,
): Promise<PendingChangeRecord | null> {
  const [updated] = await db
    .update(pendingChanges)
    .set(
      success
        ? {
            status: 'applied',
            appliedAt: new Date(),
            leaseId: null,
            leaseExpiresAt: null,
            lastError: null,
          }
        : {
            status: 'failed',
            lastError: error || 'Execution failed',
            leaseId: null,
            leaseExpiresAt: null,
          },
    )
    .where(
      and(
        eq(pendingChanges.id, changeId),
        eq(pendingChanges.siteId, siteId),
        eq(pendingChanges.leaseId, leaseId),
      ),
    )
    .returning()

  return updated || null
}

export async function createPendingChange(data: {
  siteId: string
  sourceId: string
  operation: string
  payload: Record<string, unknown>
}): Promise<PendingChangeRecord> {
  const [created] = await db
    .insert(pendingChanges)
    .values({
      siteId: data.siteId,
      sourceId: data.sourceId,
      operation: data.operation,
      payload: data.payload,
      status: 'pending',
    })
    .returning()

  return created
}

export async function retryPendingChange(id: string): Promise<void> {
  await db
    .update(pendingChanges)
    .set({
      status: 'pending',
      attemptCount: 0,
      lastError: null,
      claimedAt: null,
      leaseId: null,
      leaseExpiresAt: null,
    })
    .where(eq(pendingChanges.id, id))
}
