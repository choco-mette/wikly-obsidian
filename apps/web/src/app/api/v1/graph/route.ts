import { NextRequest, NextResponse } from 'next/server'
import type { GraphResponse } from '@wikly/api-contracts'
import { sitesRepo, pagesRepo } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
): Promise<NextResponse<GraphResponse>> {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug') || undefined
    const depthStr = searchParams.get('depth')
    const depth = depthStr
      ? Math.min(Math.max(parseInt(depthStr, 10) || 1, 1), 3)
      : 1

    const site = await sitesRepo.getSiteBySlug('default')
    if (!site) {
      return NextResponse.json(
        { success: false, error: 'Site not found' },
        { status: 404 },
      )
    }

    const data = await pagesRepo.getGraphData(site.id, {
      pageSlug: slug,
      depth,
    })

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
