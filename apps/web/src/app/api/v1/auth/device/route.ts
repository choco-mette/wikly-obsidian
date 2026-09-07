import { NextResponse } from 'next/server'
import { deviceAuthRequestSchema } from '@wikly/validation'
import { devicesRepo } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const parsed = deviceAuthRequestSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(', '),
        },
        { status: 400 },
      )
    }

    const { siteId, name } = parsed.data
    const { deviceId, token } = await devicesRepo.registerDevice(siteId, name)

    return NextResponse.json(
      {
        success: true,
        deviceId,
        token,
      },
      { status: 201 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 400 },
    )
  }
}
