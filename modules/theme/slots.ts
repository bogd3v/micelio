import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { ThemeContext, ThemeComponent } from './context'
import { SLOT_NAMES } from './data'
import type { ThemeManifest } from './themes'

// ADR 0005, section 4: a theme's slots/<Name>.vue, else the core default in app/theme/defaults/
const DEFAULTS_DIR = 'theme/defaults'

/** The component each slot renders: the theme's file when it ships one, else the core default. */
export function resolveSlots(themeDir: string, defaultsDir: string): ThemeComponent[] {
  return SLOT_NAMES.map((name) => {
    const own = join(themeDir, 'slots', `${name}.vue`)
    return { name, filePath: existsSync(own) ? own : join(defaultsDir, `${name}.vue`) }
  })
}

/** The theme's slots/*.css in a fixed order, as the @import lines of the `micelio/theme.css` template. */
export function slotStyles(themeDir: string): string {
  const dir = join(themeDir, 'slots')
  if (!existsSync(dir)) return ''
  return readdirSync(dir)
    .filter(file => file.endsWith('.css'))
    .sort()
    .map(file => `@import "${join(dir, file)}";`)
    .join('\n')
}

/** Fails for a slot outside the closed list, a slots/ file that is not a slot, or an `island` that is not a boolean. */
export function validateSlots(manifest: ThemeManifest, dir: string): void {
  const known: readonly string[] = SLOT_NAMES
  for (const [name, options] of Object.entries(manifest.slots ?? {})) {
    if (!known.includes(name)) throw new Error(`Theme "${manifest.id}": theme.json declares the slot "${name}", which is not one of ${SLOT_NAMES.join(', ')}`)
    const island = (options as { island?: unknown } | null)?.island
    if (island !== undefined && typeof island !== 'boolean') throw new Error(`Theme "${manifest.id}": slots.${name}.island must be true or false`)
  }
  const slotsDir = join(dir, 'slots')
  if (!existsSync(slotsDir)) return
  for (const file of readdirSync(slotsDir).filter(file => file.endsWith('.vue'))) {
    if (!known.includes(file.slice(0, -4))) throw new Error(`Theme "${manifest.id}": slots/${file} is not a slot; the slots are ${SLOT_NAMES.join(', ')}`)
  }
}

// Slots are plain components for now: `island` is recorded in #micelio/theme (data.ts) and enforced by the theme validator (#237, PR 7)
export function setupSlots(ctx: ThemeContext): void {
  const defaultsDir = resolve(ctx.nuxt.options.srcDir, DEFAULTS_DIR)
  ctx.components.push(...resolveSlots(ctx.dir, defaultsDir))
  ctx.slotCss.push(() => slotStyles(ctx.dir))
  ctx.validators.push(validateSlots)
}
