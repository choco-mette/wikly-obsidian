import { NextResponse } from 'next/server'
import { syncChangesQuerySchema } from '@wikly/validation'
import type { SyncChangeItem, SyncChangesResponse } from '@wikly/api-contracts'
import { devicesRepo, pendingChangesRepo } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Missing or malformed Authorization header' },
        { status: 401 },
      )
    }

    const token = authHeader.slice(7).trim()
    const device = await devicesRepo.findApprovedDeviceByToken(token)
    if (!device) {
      return NextResponse.json(
        { success: false, error: 'Invalid or unauthorized device token' },
        { status: 401 },
      )
    }

    const url = new URL(request.url)
    const cursor = url.searchParams.get('cursor') || undefined
    const limitParam = url.searchParams.get('limit') || undefined

    const parsedQuery = syncChangesQuerySchema.safeParse({
      cursor,
      limit: limitParam,
    })

    const limit = parsedQuery.success ? parsedQuery.data.limit : 50

    const rawChanges = await pendingChangesRepo.getSyncChanges(
      device.siteId,
      cursor,
      limit,
    )

    const changes: SyncChangeItem[] = rawChanges.map((item) => {
      const payloadObj = (item.payload || {}) as Record<string, unknown>
      return {
        id: item.id,
        sourceId: item.sourceId,
        operation: item.operation,
        baseRevision:
          typeof payloadObj.baseRevision === 'number'
            ? payloadObj.baseRevision
            : undefined,
        patch:
          payloadObj.patch && typeof payloadObj.patch === 'object'
            ? (payloadObj.patch as Record<string, unknown>)
            : payloadObj,
        createdAt: item.createdAt.toISOString(),
      }
    })

    const nextCursor =
      changes.length > 0 ? changes[changes.length - 1].id : cursor

    const response: SyncChangesResponse = {
      success: true,
      changes,
      nextCursor,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching sync changes:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
