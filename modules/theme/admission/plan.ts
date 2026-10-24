import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { InstalledTheme } from '../types'

/** Whether a theme ships code: `slots/` or `templates/` (ADR 0008, decision 1). The installer decides it again from the files. */
export function hasCode(theme: InstalledTheme): boolean {
  return existsSync(join(theme.dir, 'slots')) || existsSync(join(theme.dir, 'templates'))
}

/**
 * Why a theme cannot be admitted on the shared core build, or undefined when it can.
 *
 * @remarks
 * A theme with code needs a build its slots are compiled into. Layout variants load at runtime since #402, so a data-only theme
 * runs on the shared build whatever variants it uses.
 */
export function ownBuildReason(theme: InstalledTheme): string | undefined {
  if (hasCode(theme)) return 'ships slots/ or templates/: a theme with code needs a build made with it (ADR 0009, section 4)'
  return undefined
}
