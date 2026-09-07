import { NextResponse } from 'next/server'
import { createPendingChangeSchema } from '@wikly/validation'
import { getSessionUser } from '@/lib/auth/session'
import { pendingChangesRepo, sitesRepo } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: admin session required' },
        { status: 401 },
      )
    }

    const json = await request.json()
    const parsed = createPendingChangeSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(', '),
        },
        { status: 400 },
      )
    }

    const {
      siteId: providedSiteId,
      sourceId,
      operation,
      baseRevision,
      patch,
    } = parsed.data

    let siteId = providedSiteId
    if (!siteId) {
      const defaultSite = await sitesRepo.getSiteBySlug('default')
      if (!defaultSite) {
        return NextResponse.json(
          { success: false, error: 'Site not found' },
          { status: 404 },
        )
      }
      siteId = defaultSite.id
    }

    const change = await pendingChangesRepo.createPendingChange({
      siteId,
      sourceId,
      operation,
      payload: {
        baseRevision,
        patch,
      },
    })

    return NextResponse.json({ success: true, change })
  } catch (error) {
    console.error('Error creating pending change:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
