import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  createSessionToken,
  verifySessionToken,
  getSessionUser,
  setSessionCookie,
  clearSessionCookie,
  SESSION_COOKIE_NAME,
  type SessionUser,
} from '../session'

// ─── helpers ────────────────────────────────────────────────────────────────

const testUser: SessionUser = { id: 'user-01', email: 'admin@example.com' }

/** Build a Request with the given cookie string in the Cookie header. */
function makeRequest(cookieValue?: string): Request {
  const headers: Record<string, string> = {}
  if (cookieValue !== undefined) {
    headers['cookie'] = cookieValue
  }
  return new Request('http://localhost/', { headers })
}

// ─── createSessionToken ──────────────────────────────────────────────────────

describe('createSessionToken', () => {
  it('returns a non-empty base64url string', () => {
    const token = createSessionToken(testUser)
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)
    // base64url charset — no +, /, or = padding
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('produces different tokens on subsequent calls (different expiresAt)', async () => {
    const t1 = createSessionToken(testUser)
    await new Promise((r) => setTimeout(r, 5))
    const t2 = createSessionToken(testUser)
    expect(t1).not.toBe(t2)
  })

  it('encodes user id and email in the payload', () => {
    const token = createSessionToken(testUser)
    const raw = Buffer.from(token, 'base64url').toString('utf8')
    expect(raw).toContain(testUser.id)
    expect(raw).toContain(testUser.email)
  })
})

// ─── verifySessionToken ──────────────────────────────────────────────────────

describe('verifySessionToken', () => {
  it('returns the user for a valid fresh token', () => {
    const token = createSessionToken(testUser)
    const result = verifySessionToken(token)
    expect(result).not.toBeNull()
    expect(result?.id).toBe(testUser.id)
    expect(result?.email).toBe(testUser.email)
  })

  it('returns null for an empty string', () => {
    expect(verifySessionToken('')).toBeNull()
  })

  it('returns null for a random non-token string', () => {
    expect(verifySessionToken('not-a-token')).toBeNull()
  })

  it('returns null for a tampered signature', () => {
    const token = createSessionToken(testUser)
    const raw = Buffer.from(token, 'base64url').toString('utf8')
    // flip last char of signature
    const tampered = raw.slice(0, -1) + (raw.endsWith('a') ? 'b' : 'a')
    const tamperedToken = Buffer.from(tampered).toString('base64url')
    expect(verifySessionToken(tamperedToken)).toBeNull()
  })

  it('returns null for a tampered email in payload', () => {
    const token = createSessionToken(testUser)
    const raw = Buffer.from(token, 'base64url').toString('utf8')
    const modified = raw.replace(testUser.email, 'evil@hacker.com')
    const modifiedToken = Buffer.from(modified).toString('base64url')
    expect(verifySessionToken(modifiedToken)).toBeNull()
  })

  it('returns null for an expired token', () => {
    // Fake Date.now() to return a time 8 days in the future so the token is stale
    const realNow = Date.now
    const token = createSessionToken(testUser)
    Date.now = () => realNow() + 8 * 24 * 60 * 60 * 1000
    try {
      expect(verifySessionToken(token)).toBeNull()
    } finally {
      Date.now = realNow
    }
  })

  it('returns null for payload with wrong number of parts', () => {
    // Only 3 parts instead of 4
    const bad = Buffer.from('id:email:12345').toString('base64url')
    expect(verifySessionToken(bad)).toBeNull()
  })

  it('returns null for non-numeric expiresAt', () => {
    const bad = Buffer.from('id:email:not-a-number:sig').toString('base64url')
    expect(verifySessionToken(bad)).toBeNull()
  })
})

// ─── getSessionUser (Request path) ───────────────────────────────────────────

describe('getSessionUser', () => {
  it('returns user from a valid cookie in Request headers', async () => {
    const token = createSessionToken(testUser)
    const req = makeRequest(`${SESSION_COOKIE_NAME}=${token}`)
    const result = await getSessionUser(req)
    expect(result?.id).toBe(testUser.id)
    expect(result?.email).toBe(testUser.email)
  })

  it('returns null when cookie header is absent', async () => {
    const req = makeRequest()
    const result = await getSessionUser(req)
    expect(result).toBeNull()
  })

  it('returns null when cookie value is invalid', async () => {
    const req = makeRequest(`${SESSION_COOKIE_NAME}=invalid-garbage`)
    const result = await getSessionUser(req)
    expect(result).toBeNull()
  })

  it('parses cookie correctly when multiple cookies present', async () => {
    const token = createSessionToken(testUser)
    const req = makeRequest(
      `other_cookie=abc; ${SESSION_COOKIE_NAME}=${token}; another=xyz`,
    )
    const result = await getSessionUser(req)
    expect(result?.email).toBe(testUser.email)
  })

  it('returns null without a Request when cookies() is unavailable (test env)', async () => {
    // No Request passed → falls into the cookies() branch which throws in vitest
    const result = await getSessionUser()
    expect(result).toBeNull()
  })
})

// ─── setSessionCookie ─────────────────────────────────────────────────────────

describe('setSessionCookie', () => {
  it('returns a Set-Cookie string containing the token', async () => {
    const token = createSessionToken(testUser)
    const setCookie = await setSessionCookie(token)
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=${token}`)
  })

  it('includes HttpOnly and SameSite=Lax attributes', async () => {
    const token = createSessionToken(testUser)
    const setCookie = await setSessionCookie(token)
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Lax')
  })

  it('includes Max-Age', async () => {
    const token = createSessionToken(testUser)
    const setCookie = await setSessionCookie(token)
    expect(setCookie).toMatch(/Max-Age=\d+/)
  })

  it('does NOT include Secure in non-production env', async () => {
    const token = createSessionToken(testUser)
    const setCookie = await setSessionCookie(token)
    expect(setCookie).not.toContain('Secure')
  })

  it('includes Secure in production env', async () => {
    const original = process.env.NODE_ENV
    // @ts-expect-error — overriding read-only env for test
    process.env.NODE_ENV = 'production'
    try {
      const token = createSessionToken(testUser)
      const setCookie = await setSessionCookie(token)
      expect(setCookie).toContain('Secure')
    } finally {
      // @ts-expect-error — restore
      process.env.NODE_ENV = original
    }
  })
})

// ─── clearSessionCookie ───────────────────────────────────────────────────────

describe('clearSessionCookie', () => {
  it('returns a Set-Cookie string that expires the session cookie', async () => {
    const clearStr = await clearSessionCookie()
    expect(clearStr).toContain(`${SESSION_COOKIE_NAME}=`)
    expect(clearStr).toContain('Max-Age=0')
  })

  it('includes HttpOnly and SameSite=Lax', async () => {
    const clearStr = await clearSessionCookie()
    expect(clearStr).toContain('HttpOnly')
    expect(clearStr).toContain('SameSite=Lax')
  })
})
