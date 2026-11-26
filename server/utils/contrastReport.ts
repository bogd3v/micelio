import { contrastPairs } from '~/helpers/contrast'
import { parseHex } from '~/helpers/color'
import type { ContrastReportResponse } from '~/interfaces/theme'
import type { RuntimeData } from '../../modules/theme/install/types'
import type { Rgba } from '../../modules/theme/types'
import { accentRoleColors, resolveTheme } from './theme'

/**
 * The contrast matrix of a theme in every mode, with candidate accents in place of its own (`GET /_micelio/contrast`).
 *
 * @remarks
 * The rules and colors are those `theme:check` measures (`runtime.contrast`, written when the theme is compiled), so with no candidate the pairs, ratios and
 * results are the ones `theme:check` gives. A candidate is resolved as a saved override is (`resolveTheme`, ADR 0005 section 8), but not logged, and its family replaces the
 * roles it moves (`accentRoleColors`); every other role keeps the theme's value. A mode the theme lacks is ignored.
 */
export function contrastReport(runtime: Pick<RuntimeData, 'id' | 'modes' | 'palette' | 'contrast'>, candidates: Array<{ mode: string, color: string }>): ContrastReportResponse['data'] {
  const resolved = candidates.length ? resolveTheme({ accentOverrides: candidates }, runtime.palette, runtime.id, { candidate: true }) : null
  const modes = runtime.modes.map(({ id }) => {
    const table = Object.hasOwn(runtime.contrast.modes, id) ? runtime.contrast.modes[id]! : {}
    const accent = resolved && Object.hasOwn(resolved.accents, id) ? resolved.accents[id]! : null
    const palette = Object.hasOwn(runtime.palette.modes, id) ? runtime.palette.modes[id] : undefined
    const moved = accent && palette ? accentRoleColors(accent, palette) : {}
    const colorOf = (role: string): Rgba | string => {
      if (Object.hasOwn(moved, role)) return parseHex(moved[role]!)!
      const color = Object.hasOwn(table, role) ? table[role] : null
      return color ? { r: color[0], g: color[1], b: color[2], a: color[3] } : `"${role}" has no color`
    }
    const pairs = contrastPairs(runtime.contrast.rules, colorOf).map(({ role, surface, ratio, min, passes }) => ({ role, surface, ratio, min, passes }))
    return { mode: id, accent, pairs }
  })
  return { theme: runtime.id, modes }
}
