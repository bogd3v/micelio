import { createHash } from 'node:crypto'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { STORE_DIR } from '../../../modules/theme/install/constants'
import type { ThemePin } from '../../../modules/theme/registry/types'
import { BACKOFF_FIRST_MS, BACKOFF_MAX_MS, BACKOFF_TRACKED, INSTALLS_PER_HOUR, STORE_MAX_BYTES, STORE_MAX_ENTRIES } from './constants'

/** Why an install may not start now. `backoff` is a pin that failed before; the reason it failed is kept, not replaced by this one. */
export interface Refusal {
  kind: 'backoff' | 'rate'
  message: string
}

/** The install rate and the backoff of failed pins (ADR 0009, section 3), in memory: a restart resets them. */
export interface InstallLimiter {
  /** Why `pin` may not be installed now, or `null`. */
  refusal: (pin: ThemePin) => Refusal | null
  /** Counts an install that is about to start toward the hourly rate. */
  begin: () => void
  fail: (pin: ThemePin) => void
  succeed: (pin: ThemePin) => void
}

const HOUR_MS = 60 * 60_000

function keyOf(pin: ThemePin): string {
  return createHash('sha256').update(`${pin.id}\0${pin.version}\0${pin.digest}`).digest('hex')
}

/**
 * Creates the limiter of one process: at most `INSTALLS_PER_HOUR` installs an hour, and after a failed pin a wait of one minute that doubles up to an hour.
 *
 * @remarks
 * The failures are kept by a hash of the pin in a bounded map, so a CMS that names many pins cannot grow it. With N replicas the
 * effective rate is N times the limit.
 *
 * @param now - The clock, in milliseconds.
 */
export function createInstallLimiter(now: () => number = Date.now): InstallLimiter {
  const failures = new Map<string, { count: number, until: number }>()
  let started: number[] = []
  return {
    refusal(pin) {
      const failed = failures.get(keyOf(pin))
      if (failed && failed.until > now()) return { kind: 'backoff', message: `this theme failed to install; the next try is in ${Math.ceil((failed.until - now()) / 1000)} s` }
      started = started.filter(time => now() - time < HOUR_MS)
      if (started.length >= INSTALLS_PER_HOUR) return { kind: 'rate', message: `this instance already started ${INSTALLS_PER_HOUR} installs in the last hour` }
      return null
    },
    begin() {
      started.push(now())
    },
    fail(pin) {
      const key = keyOf(pin)
      const count = (failures.get(key)?.count ?? 0) + 1
      failures.delete(key)
      failures.set(key, { count, until: now() + Math.min(BACKOFF_FIRST_MS * 2 ** (count - 1), BACKOFF_MAX_MS) })
      if (failures.size > BACKOFF_TRACKED) failures.delete(failures.keys().next().value as string)
    },
    succeed(pin) {
      failures.delete(keyOf(pin))
    },
  }
}

async function bytesUnder(dir: string): Promise<number> {
  let total = 0
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    // A folder that is not there holds nothing
    return 0
  }
  for (const name of names) {
    const path = join(dir, name)
    const info = await stat(path)
    total += info.isDirectory() ? await bytesUnder(path) : info.size
  }
  return total
}

/**
 * Why the deployment store has no room for another install, or `null`: it holds `STORE_MAX_ENTRIES` entries, or `STORE_MAX_BYTES` in entries and kept packages.
 *
 * @remarks
 * A request never evicts anything (ADR 0009, open question 3): at the cap the install is refused and logged, and the operator removes entries.
 */
export async function storeFull(storeDir: string): Promise<string | null> {
  const root = join(storeDir, STORE_DIR)
  let entries = 0
  try {
    entries = (await readdir(join(root, 'entries'))).length
  } catch {
    // No entries yet
  }
  if (entries >= STORE_MAX_ENTRIES) return `the theme store holds ${entries} entries, its limit; remove some before installing another`
  const bytes = await bytesUnder(join(root, 'entries')) + await bytesUnder(join(root, 'packages'))
  if (bytes >= STORE_MAX_BYTES) return `the theme store holds ${Math.round(bytes / 1024 / 1024)} MiB, its limit; remove some before installing another`
  return null
}
