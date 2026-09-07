import { describe, it, expect } from 'vitest'
import {
  checkRateLimit,
  getClientIp,
  getRateLimitHeaders,
} from '../rateLimit'

describe('Rate Limiter', () => {
  it('allows requests within limit and decrements remaining tokens', () => {
    const key = `test-client-${Date.now()}`
    const config = { intervalMs: 1000, maxRequests: 3 }

    const res1 = checkRateLimit(key, config)
    expect(res1.success).toBe(true)
    expect(res1.remaining).toBe(2)
    expect(res1.limit).toBe(3)

    const res2 = checkRateLimit(key, config)
    expect(res2.success).toBe(true)
    expect(res2.remaining).toBe(1)

    const res3 = checkRateLimit(key, config)
    expect(res3.success).toBe(true)
    expect(res3.remaining).toBe(0)

    // 4th request exceeds limit
    const res4 = checkRateLimit(key, config)
    expect(res4.success).toBe(false)
    expect(res4.remaining).toBe(0)
  })

  it('correctly extracts client IP from headers', () => {
    const req1 = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18' },
    })
    expect(getClientIp(req1)).toBe('203.0.113.195')

    const req2 = new Request('http://localhost', {
      headers: { 'x-real-ip': '198.51.100.1' },
    })
    expect(getClientIp(req2)).toBe('198.51.100.1')

    const req3 = new Request('http://localhost')
    expect(getClientIp(req3)).toBe('127.0.0.1')
  })

  it('generates standard rate limit headers', () => {
    const headers = getRateLimitHeaders({
      success: false,
      limit: 10,
      remaining: 0,
      resetMs: 45000,
    })

    expect(headers['X-RateLimit-Limit']).toBe('10')
    expect(headers['X-RateLimit-Remaining']).toBe('0')
    expect(headers['X-RateLimit-Reset']).toBe('45')
    expect(headers['Retry-After']).toBe('45')
  })
})
