import { NextResponse } from 'next/server'
import type { SyncClaimResponse } from '@wikly/api-contracts'
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

    const claim = await pendingChangesRepo.claimChange(id, device.siteId)
    if (!claim) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Change could not be claimed (already claimed or does not exist)',
        },
        { status: 409 },
      )
    }

    const response: SyncClaimResponse = {
      success: true,
      leaseId: claim.leaseId,
      leaseExpiresAt: claim.leaseExpiresAt.toISOString(),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error claiming sync change:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
