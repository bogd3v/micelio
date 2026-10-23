import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_LAYOUT, LAYOUT_REGIONS } from '../constants'
import type { InstalledTheme } from '../types'

/** Whether a theme ships code: `slots/` or `templates/` (ADR 0008, decision 1). The installer decides it again from the files. */
export function hasCode(theme: InstalledTheme): boolean {
  return existsSync(join(theme.dir, 'slots')) || existsSync(join(theme.dir, 'templates'))
}

/**
 * Why a theme cannot be admitted on the shared core build, or undefined when it can.
 *
 * @remarks
 * The rule of `loadDefaultTheme` (`server/lib/builtInStore.ts`): the server serves a theme the build was not made with only when it
 * ships no code and uses the layout variants of the build's theme. #402 lifts the layout half.
 *
 * @param base - The theme the shared build is made with.
 */
export function ownBuildReason(theme: InstalledTheme, base: InstalledTheme): string | undefined {
  if (hasCode(theme)) return 'ships slots/ or templates/: a theme with code needs a build made with it (ADR 0009, section 4)'
  const layout = (manifest: InstalledTheme['manifest']): Record<string, string> => ({ ...DEFAULT_LAYOUT, ...manifest.layout })
  const differs = LAYOUT_REGIONS.filter(region => layout(theme.manifest)[region] !== layout(base.manifest)[region])
  if (differs.length) return `uses other layout variants (${differs.join(', ')}) than the shared build carries until they load at runtime (#402)`
  return undefined
}
