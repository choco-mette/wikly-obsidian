import { NextResponse } from 'next/server'
import { usersRepo } from '@/lib/db'
import {
  clearSessionCookie,
  createSessionToken,
  setSessionCookie,
} from '@/lib/auth/session'
import { checkRateLimit, getClientIp, getRateLimitHeaders } from '@/lib/rateLimit'

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(`admin-login:${ip}`, {
    intervalMs: 60_000,
    maxRequests: 5,
  })

  if (!rateLimit.success) {
    return NextResponse.json(
      { success: false, error: 'Terlalu banyak percobaan login. Tunggu 1 menit.' },
      {
        status: 429,
        headers: getRateLimitHeaders(rateLimit),
      },
    )
  }

  try {
    const json = await request.json()
    const { email, password } = json

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email dan kata sandi wajib diisi' },
        { status: 400 },
      )
    }

    const user = await usersRepo.verifyAdminCredentials(email, password)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Email atau kata sandi tidak valid' },
        { status: 401 },
      )
    }

    const token = createSessionToken({ id: user.id, email: user.email })
    const cookieHeader = await setSessionCookie(token)

    return NextResponse.json(
      {
        success: true,
        user: { id: user.id, email: user.email },
      },
      {
        headers: {
          'Set-Cookie': cookieHeader,
        },
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}

export async function DELETE() {
  try {
    const clearHeader = await clearSessionCookie()
    return NextResponse.json(
      { success: true },
      {
        headers: {
          'Set-Cookie': clearHeader,
        },
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
