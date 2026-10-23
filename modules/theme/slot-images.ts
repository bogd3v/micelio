import { join, sep } from 'node:path'
import type { Plugin } from 'vite'
import { IMAGES_URL, THEME_ID } from './constants'

/** A theme whose slots are compiled into a build, for `slotImagesPlugin`. */
export interface SlotImagesTheme {
  id: string
  dir: string
}

// A quote or backtick, then the prefix: only a URL written whole in the source is rewritten
const PREFIX = new RegExp(`(['"\`])/${IMAGES_URL}/`, 'g')

/**
 * Rewrites `/theme/images/` to `/theme/<id>/images/` where it opens a quoted string or attribute.
 *
 * @remarks
 * The slots of a theme other than the build's read their images at `/theme/<id>/images/` (ADR 0009, amendment of
 * 2026-10-23). A URL assembled at runtime is left as it is.
 *
 * @throws `Error` when `id` is not a valid theme id.
 */
export function rewriteSlotImages(code: string, id: string): string {
  if (!THEME_ID.test(id)) throw new Error(`Theme id "${id}" is not valid`)
  return code.replace(PREFIX, `$1/theme/${id}/images/`)
}

/**
 * A Vite plugin that runs `rewriteSlotImages` on the source files of every theme's `slots/` except the build theme's.
 *
 * @remarks
 * It runs before the Vue compiler, so a template `src` becomes an import of the theme's own public file, and the strings
 * a slot passes to `useImage()` name its own images. The build theme's slots are not touched, so its output does not change.
 */
export function slotImagesPlugin(themes: readonly SlotImagesTheme[], buildTheme: string): Plugin {
  const others = themes.filter(theme => theme.id !== buildTheme).map(theme => ({ id: theme.id, slots: join(theme.dir, 'slots') + sep }))
  return {
    name: 'micelio:slot-images',
    enforce: 'pre',
    transform(code, file) {
      const path = file.split('?')[0]!
      const theme = others.find(other => path.startsWith(other.slots))
      if (!theme || !code.includes(`/${IMAGES_URL}/`)) return null
      return { code: rewriteSlotImages(code, theme.id), map: null }
    },
  }
}
