import { NextResponse } from 'next/server'
import { deviceAuthRequestSchema } from '@wikly/validation'
import { devicesRepo } from '@/lib/db'
import { checkRateLimit, getClientIp, getRateLimitHeaders } from '@/lib/rateLimit'

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(`auth-device:${ip}`, {
    intervalMs: 60_000,
    maxRequests: 10,
  })

  if (!rateLimit.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Too many authentication attempts. Please wait.',
      },
      {
        status: 429,
        headers: getRateLimitHeaders(rateLimit),
      },
    )
  }

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

    const { siteId, pairingCode } = parsed.data
    const { deviceId, name, token } = await devicesRepo.pairDevice(
      siteId,
      pairingCode,
    )

    return NextResponse.json(
      {
        success: true,
        deviceId,
        name,
        token,
        status: 'approved',
      },
      { status: 200 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 401 },
    )
  }
}
