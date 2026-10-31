import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { STORE_DIR } from '../../../modules/theme/install/constants'
import { pinProblem } from '../../../modules/theme/registry/pin'
import type { ThemePin } from '../../../modules/theme/registry/types'
import { STATE_FILE } from './constants'
import type { PersistedPins } from './types'

function pinOf(value: unknown): ThemePin | null {
  if (typeof value !== 'object' || value === null) return null
  const { id, version, digest } = value as Record<string, unknown>
  const pin = { id, version, digest }
  return pinProblem(pin) === null ? pin as ThemePin : null
}

/**
 * The pins the deployment store remembers: the active and the last good theme, each `null` when none was saved or what was saved is not a valid pin.
 *
 * @remarks
 * Boot compiles these again for the new core build and activates the active one before the first request, so a restart does not show the default theme.
 * A missing, unreadable or malformed file is not an error: the site starts on the default theme and the site settings decide.
 */
export async function readPins(storeDir: string): Promise<PersistedPins> {
  try {
    const raw = JSON.parse(await readFile(join(storeDir, STORE_DIR, STATE_FILE), 'utf8')) as { active?: unknown, lastGood?: unknown }
    return { active: pinOf(raw.active), lastGood: pinOf(raw.lastGood) }
  } catch {
    // No state yet, or one cut short: the same as none
    return { active: null, lastGood: null }
  }
}

/** Saves the pins by writing a file beside the state and renaming it into place, so a restart never reads half of it. */
export async function writePins(storeDir: string, pins: PersistedPins): Promise<void> {
  const dir = join(storeDir, STORE_DIR)
  await mkdir(dir, { recursive: true })
  const staging = join(dir, `${STATE_FILE}.${process.pid}.tmp`)
  await writeFile(staging, JSON.stringify(pins), { mode: 0o600 })
  await rename(staging, join(dir, STATE_FILE))
}
