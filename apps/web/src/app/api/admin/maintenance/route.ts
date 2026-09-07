import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { maintenanceRepo, sitesRepo } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const session = await getSessionUser(request)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      )
    }

    const { searchParams } = new URL(request.url)
    let action = searchParams.get('action')

    let body: Record<string, unknown> = {}
    try {
      body = (await request.json()) as Record<string, unknown>
      if (!action && typeof body.action === 'string') {
        action = body.action
      }
    } catch {
      // Body may be empty if action passed via query param
    }

    const defaultSite = await sitesRepo.getSiteBySlug('default')
    if (!defaultSite) {
      return NextResponse.json(
        { success: false, error: 'Default site not found' },
        { status: 404 },
      )
    }

    if (action === 'gc') {
      const olderThanHours =
        typeof body.olderThanHours === 'number' ? body.olderThanHours : 24
      const result = await maintenanceRepo.garbageCollectOrphanAssets(
        defaultSite.id,
        olderThanHours,
      )
      return NextResponse.json({
        success: true,
        action: 'gc',
        result,
      })
    }

    if (action === 'reconcile') {
      const result = await maintenanceRepo.reconcileVault(defaultSite.id)
      return NextResponse.json({
        success: true,
        action: 'reconcile',
        result,
      })
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action. Use action=gc or action=reconcile.',
      },
      { status: 400 },
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
