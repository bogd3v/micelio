export interface RateLimitRule {
  limit: number
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
