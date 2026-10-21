import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { ThemeContext, ThemeComponent } from './types'
import { SLOT_NAMES } from './constants'

// ADR 0005, section 4: a theme's slots/<Name>.vue, else the core default in app/theme/defaults/
const DEFAULTS_DIR = 'theme/defaults'

/** The component each slot renders: the theme's file when it ships one, else the core default. */
export function resolveSlots(themeDir: string, defaultsDir: string): ThemeComponent[] {
  return SLOT_NAMES.map((name) => {
    const own = join(themeDir, 'slots', `${name}.vue`)
    return { name, filePath: existsSync(own) ? own : join(defaultsDir, `${name}.vue`) }
  })
}

// Slots are plain components for now: `island` is recorded in the theme's `runtime.json` and enforced by the theme validator (#237, PR 7)
/**
 * Registers the component of each slot at build time.
 *
 * @remarks
 * A slot renders the theme's `slots/<Name>.vue` when it ships one, else the core default in `app/theme/defaults/`. The components
 * are added to the context and registered by `setupComponents`. The theme's `slots/*.css` files are compiled into the
 * theme's stylesheet in the store (`install/compile.ts`).
 */
export function setupSlots(ctx: ThemeContext): void {
  const defaultsDir = resolve(ctx.nuxt.options.srcDir, DEFAULTS_DIR)
  ctx.components.push(...resolveSlots(ctx.dir, defaultsDir))
}
