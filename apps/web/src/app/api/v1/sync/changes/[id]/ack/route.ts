import { NextResponse } from 'next/server'
import { syncAckSchema } from '@wikly/validation'
import type { SyncAckResponse } from '@wikly/api-contracts'
import { devicesRepo, pendingChangesRepo } from '@/lib/db'

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
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

    const { id } = await props.params
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Change ID is required' },
        { status: 400 },
      )
    }

    const body = await request.json()
    const parsed = syncAckSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(', '),
        },
        { status: 400 },
      )
    }

    const { success, leaseId, errorCode, message } = parsed.data
    const errorMsg = message || errorCode

    const updated = await pendingChangesRepo.ackChange(
      id,
      device.siteId,
      leaseId,
      success,
      errorMsg,
    )

    if (!updated) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not ACK change: invalid lease ID or change not found',
        },
        { status: 409 },
      )
    }

    const response: SyncAckResponse = {
      success: true,
      status: updated.status,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error acknowledging sync change:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
