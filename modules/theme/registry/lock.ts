import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { THEME_ID } from '../constants'
import { parseContractVersion } from '../version'
import { LOCK_FILE, THEME_DIGEST } from './constants'
import { RegistryError, safeText } from './error'
import { pinProblem } from './pin'
import type { ThemeLock } from './types'

// `themes.lock.json` (ADR 0008, decision 5): the exact version and digest of every theme a site pins.

/** The lock is a few lines per theme; this is far above any real one and keeps a hostile file from being read whole. */
const MAX_LOCK_BYTES = 256 * 1024

const Entry = z.strictObject({
  version: z.string(),
  digest: z.string().regex(THEME_DIGEST),
  contract: z.string().refine(value => parseContractVersion(value) !== null, { error: 'must be major.minor' }),
  tier: z.enum(['official', 'verified', 'community', 'local']),
  distribution: z.enum(['public', 'licensed', 'file']),
  registry: z.string().min(1).max(256).nullable(),
  code: z.boolean(),
}).refine(entry => (entry.distribution === 'file') === (entry.registry === null) && (entry.distribution === 'file') === (entry.tier === 'local'), {
  error: 'a file entry has registry null and tier local, and only a file entry does',
})

const Lock = z.record(z.string().regex(THEME_ID), Entry).refine(lock => Object.keys(lock).length <= 64, { error: 'lists more than 64 themes' })

/**
 * Reads and validates a lock from its text.
 *
 * @throws `RegistryError` (`lock`) naming the entry and the rule it breaks.
 */
export function parseLock(text: string): ThemeLock {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    throw new RegistryError('lock', `${LOCK_FILE} is not valid JSON: ${safeText((error as Error).message)}`, {}, { cause: error })
  }
  // zod's record skips a `__proto__` key; a lock with one is refused, not read as if the entry were absent
  for (const key of typeof value === 'object' && value !== null ? Object.keys(value) : []) {
    if (!THEME_ID.test(key)) throw new RegistryError('lock', `${LOCK_FILE} has an entry whose key is not a theme id`)
  }
  const parsed = Lock.safeParse(value)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new RegistryError('lock', `${LOCK_FILE} ${issue?.path.join('.') || 'root'}: ${issue?.message ?? 'is invalid'}`)
  }
  for (const [id, entry] of Object.entries(parsed.data)) {
    const problem = pinProblem({ id, ...entry })
    if (problem !== null) throw new RegistryError('lock', `${LOCK_FILE} entry "${id}": ${problem}`)
  }
  return parsed.data
}

/** The lock text: entries sorted by id, two-space indent and a final newline, so a lock written twice is identical. */
export function formatLock(lock: ThemeLock): string {
  const sorted = Object.fromEntries(Object.entries(lock).sort(([a], [b]) => (a < b ? -1 : 1)))
  return `${JSON.stringify(sorted, null, 2)}\n`
}

/** Reads `themes.lock.json` under `root`; an empty lock when the file does not exist. */
export function readLock(root: string): ThemeLock {
  const file = join(root, LOCK_FILE)
  if (!existsSync(file)) return {}
  const data = readFileSync(file)
  if (data.length > MAX_LOCK_BYTES) throw new RegistryError('lock', `${LOCK_FILE} is larger than ${MAX_LOCK_BYTES} bytes`)
  return parseLock(data.toString('utf8'))
}

/** Writes `themes.lock.json` under `root` through a temporary file, so an interrupted write never leaves half a lock. */
export function writeLock(root: string, lock: ThemeLock): void {
  const file = join(root, LOCK_FILE)
  const temporary = `${file}.${process.pid}.tmp`
  writeFileSync(temporary, formatLock(parseLock(formatLock(lock))))
  renameSync(temporary, file)
}
