import { NextResponse } from 'next/server'
import { publishRequestSchema } from '@wikly/validation'
import { devicesRepo, publishingRepo } from '@/lib/db'
import { RevisionConflictError } from '@/lib/db/repos/publishing'

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or malformed Authorization header',
        },
        { status: 401 },
      )
    }

    const token = authHeader.slice(7).trim()
    const json = await request.json()
    const parsed = publishRequestSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(', '),
        },
        { status: 400 },
      )
    }

    const payload = parsed.data

    // Authenticate device for this site
    const device = await devicesRepo.validateDeviceToken(payload.siteId, token)
    if (!device) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or unauthorized device token for this site',
        },
        { status: 401 },
      )
    }

    const result = await publishingRepo.publishPage({
      siteId: payload.siteId,
      sourceId: payload.sourceId,
      path: payload.path,
      title: payload.title,
      slug: payload.slug,
      markdown: payload.markdown,
      frontmatter: payload.frontmatter,
      contentHash: payload.contentHash,
      serverRevision: payload.serverRevision,
    })

    return NextResponse.json(
      {
        success: true,
        changed: result.changed,
        page: result.page,
        contentHash: result.contentHash,
      },
      { status: 200 },
    )
  } catch (error) {
    if (error instanceof RevisionConflictError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 409 },
      )
    }

    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    )
  }
}
