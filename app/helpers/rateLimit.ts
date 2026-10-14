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
  /** How many keys are tracked now, expired windows included until they are pruned. Never more than the cap. */
  size: () => number
}

interface RateWindow {
  count: number
  resetAt: number
}

const MAX_TRACKED_KEYS = 10_000
// When the map is full of live windows this many of the oldest are dropped at once, so the cost of the pass is shared by the next inserts
const EVICTED_AT_ONCE = MAX_TRACKED_KEYS / 10

/**
 * Creates a fixed-window rate limiter kept in process memory.
 *
 * @remarks
 * The counts are per process, so a limit is per instance. At most 10 000 keys are tracked: when a window starts and the map is full, expired windows are pruned first and, if it is still full, the oldest tenth are dropped. A flood of new keys therefore costs a bounded amount of memory, and the pass over the map happens once per thousand keys, not once per key.
 */
export function createRateLimiter(): RateLimiter {
  const windows = new Map<string, RateWindow>()

  function prune(now: number): void {
    for (const [key, window] of windows) {
      if (window.resetAt <= now) windows.delete(key)
    }
  }

  function evictOldest(): void {
    // A Map keeps insertion order, and a window is inserted when it starts: the first ones are the oldest
    let dropped = 0
    for (const key of windows.keys()) {
      windows.delete(key)
      if (++dropped >= EVICTED_AT_ONCE) return
    }
  }

  function consume(key: string, rule: RateLimitRule, now: number = Date.now()): RateLimitResult {
    let window = windows.get(key)
    if (!window || window.resetAt <= now) {
      if (windows.size >= MAX_TRACKED_KEYS) {
        prune(now)
        if (windows.size >= MAX_TRACKED_KEYS) evictOldest()
      }
      window = { count: 0, resetAt: now + rule.windowMs }
      // A key that starts a new window goes to the end of the order
      windows.delete(key)
      windows.set(key, window)
    }
    window.count += 1
    return {
      allowed: window.count <= rule.limit,
      retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
    }
  }

  return { consume, size: () => windows.size }
}
