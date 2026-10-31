import { dirname } from 'node:path'
import type { ThemeLock } from '../registry/types'
import { isPulledRoot } from '../themes'

/**
 * The package digest the lock pins for a built-in theme, or `undefined` when the theme's folder is not the pulled one.
 *
 * @remarks
 * A local `themes/<id>` (or a `MICELIO_THEME_DIRS` folder) shadows the pulled theme of the same id outside CI. Its bytes are not the pinned
 * package, so it carries no pin and a site-settings pin can never activate it (ADR 0009, section 3).
 *
 * @param themeDir - The folder the theme was installed from.
 */
export function lockedDigest(lock: ThemeLock, id: string, themeDir: string): string | undefined {
  return Object.hasOwn(lock, id) && isPulledRoot(dirname(themeDir)) ? lock[id]!.digest : undefined
}
