import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Route } from 'next'

export const SESSION_COOKIE_NAME = 'wikly_session'
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function getSessionSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    'wikly-default-super-secret-key-for-admin-sessions-32-chars!'
  )
}

export interface SessionUser {
  id: string
  email: string
}

export function createSessionToken(user: SessionUser): string {
  const expiresAt = Date.now() + SESSION_DURATION_MS
  const payload = `${user.id}:${user.email}:${expiresAt}`
  const signature = createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('hex')

  return Buffer.from(`${payload}:${signature}`).toString('base64url')
}

export function verifySessionToken(token: string): SessionUser | null {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8')
    const parts = raw.split(':')
    if (parts.length !== 4) return null

    const [id, email, expiresAtStr, signature] = parts
    const expiresAt = Number(expiresAtStr)

    if (isNaN(expiresAt) || Date.now() > expiresAt) {
      return null
    }

    const payload = `${id}:${email}:${expiresAtStr}`
    const expectedSignature = createHmac('sha256', getSessionSecret())
      .update(payload)
      .digest('hex')

    const sigBuf = Buffer.from(signature, 'hex')
    const expBuf = Buffer.from(expectedSignature, 'hex')

    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null
    }

    return { id, email }
  } catch {
    return null
  }
}

export async function getSessionUser(
  request?: Request,
): Promise<SessionUser | null> {
  if (request) {
    const cookieHeader = request.headers.get('cookie')
    if (cookieHeader) {
      const match = cookieHeader.match(
        new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`),
      )
      if (match && match[1]) {
        const user = verifySessionToken(match[1])
        if (user) return user
      }
    }
  }

  try {
    const cookieStore = await cookies()
    const cookie = cookieStore.get(SESSION_COOKIE_NAME)
    if (cookie?.value) {
      return verifySessionToken(cookie.value)
    }
  } catch {
    // cookies() unavailable in isolated test environments
  }

  return null
}

export async function setSessionCookie(token: string): Promise<string> {
  const cookieOptions = [
    `${SESSION_COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_DURATION_MS / 1000}`,
  ]
  if (process.env.NODE_ENV === 'production') {
    cookieOptions.push('Secure')
  }
  const setCookieString = cookieOptions.join('; ')

  try {
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATION_MS / 1000,
      path: '/',
    })
  } catch {
    // Ignore in non-action test environments
  }

  return setCookieString
}

export async function clearSessionCookie(): Promise<string> {
  const clearString = `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`

  try {
    const cookieStore = await cookies()
    cookieStore.delete(SESSION_COOKIE_NAME)
  } catch {
    // Ignore in isolated test environments
  }

  return clearString
}

export async function requireAdminSession(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) {
    redirect('/admin/login' as Route<string>)
  }
  return user
}
