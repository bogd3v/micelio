/** At most `limit` requests per key in each window of `windowMs`. */
export interface RateLimitRule {
  /** Requests allowed in one window. */
  limit: number
  /** Window length in milliseconds; a window starts at a key's first request after its previous window ended. */
  windowMs: number
}

interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

interface RateLimiter {
  consume: (key: string, rule: RateLimitRule, now?: number) => RateLimitResult
}

interface RateWindow {
  count: number
  resetAt: number
}

const MAX_TRACKED_KEYS = 10_000

/**
 * Creates a fixed-window rate limiter kept in process memory.
 *
 * @remarks
 * The counts are per process, so a limit is per instance. When a window starts and 10 000 or more keys are tracked, expired windows are pruned first.
 */
export function createRateLimiter(): RateLimiter {
  const windows = new Map<string, RateWindow>()

  function prune(now: number): void {
    for (const [key, window] of windows) {
      if (window.resetAt <= now) windows.delete(key)
    }
  }

  function consume(key: string, rule: RateLimitRule, now: number = Date.now()): RateLimitResult {
    let window = windows.get(key)
    if (!window || window.resetAt <= now) {
      if (windows.size >= MAX_TRACKED_KEYS) prune(now)
      window = { count: 0, resetAt: now + rule.windowMs }
      windows.set(key, window)
    }
    window.count += 1
    return {
      allowed: window.count <= rule.limit,
      retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
    }
  }

  return { consume }
}
