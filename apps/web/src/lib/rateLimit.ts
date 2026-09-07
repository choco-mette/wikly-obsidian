export interface RateLimitConfig {
  intervalMs: number // Window duration in ms (e.g. 60_000 = 1 minute)
  maxRequests: number // Max allowed requests per window
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetMs: number
}

interface Bucket {
  tokens: number
  lastRefill: number
}

const buckets = new Map<string, Bucket>()

// Purge inactive buckets every 5 minutes to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, bucket] of buckets.entries()) {
      if (now - bucket.lastRefill > 300_000) {
        buckets.delete(key)
      }
    }
  }, 300_000)
}

/**
 * Checks and consumes a token for a given key (e.g., IP + endpoint).
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now()
  const bucket = buckets.get(key) || {
    tokens: config.maxRequests,
    lastRefill: now,
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill
  if (elapsed >= config.intervalMs) {
    bucket.tokens = config.maxRequests
    bucket.lastRefill = now
  } else {
    // Fractional refill
    const tokensToAdd = Math.floor(
      (elapsed / config.intervalMs) * config.maxRequests,
    )
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(config.maxRequests, bucket.tokens + tokensToAdd)
      bucket.lastRefill = now
    }
  }

  const resetMs = Math.max(0, config.intervalMs - (now - bucket.lastRefill))

  if (bucket.tokens > 0) {
    bucket.tokens -= 1
    buckets.set(key, bucket)
    return {
      success: true,
      limit: config.maxRequests,
      remaining: bucket.tokens,
      resetMs,
    }
  }

  buckets.set(key, bucket)
  return {
    success: false,
    limit: config.maxRequests,
    remaining: 0,
    resetMs,
  }
}

/**
 * Extracts client IP from Request headers.
 */
export function getClientIp(request: Request): string {
  const xForwardedFor = request.headers.get('x-forwarded-for')
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',')
    const clientIp = ips[0]?.trim()
    if (clientIp) return clientIp
  }

  const xRealIp = request.headers.get('x-real-ip')
  if (xRealIp) return xRealIp.trim()

  return '127.0.0.1'
}

/**
 * Formats rate limit response headers.
 */
export function getRateLimitHeaders(
  result: RateLimitResult,
): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetMs / 1000).toString(),
    ...(result.success
      ? {}
      : { 'Retry-After': Math.ceil(result.resetMs / 1000).toString() }),
  }
}
