import { buildInitScript } from './init-script.mjs'
import type { ThemeContext } from './context'
import type { ModeDefinition } from './data'
import type { ThemeManifest } from './themes'

/** The init script stays under 2 KB (ADR 0004: it is inline on every page). */
export const MAX_MODES = 6

const MODE_ID = /^[\w-]+$/

/** Mode ids go into the init script, CSS selectors and <html> attributes: checked here, not left to a later check. */
export function validateModes(manifest: ThemeManifest): void {
  const { id, modes } = manifest
  if (!Array.isArray(modes) || modes.length === 0) throw new Error(`Theme "${id}": declares no modes`)
  if (modes.length > MAX_MODES) throw new Error(`Theme "${id}": ${modes.length} modes, at most ${MAX_MODES} (the init script must stay under 2 KB)`)
  const seen = new Set<string>()
  for (const mode of modes) {
    if (typeof mode.id !== 'string' || !MODE_ID.test(mode.id)) throw new Error(`Theme "${id}": mode id "${String(mode.id)}" must match ^[\\w-]+$`)
    if (mode.scheme !== 'dark' && mode.scheme !== 'light') throw new Error(`Theme "${id}": mode "${mode.id}" has scheme "${String(mode.scheme)}", expected "dark" or "light"`)
    if (seen.has(mode.id)) throw new Error(`Theme "${id}": mode "${mode.id}" is declared twice`)
    seen.add(mode.id)
  }
}

/**
 * Pressed and idle look of the mode switch for each mode, before hydration sets aria-pressed.
 * The first mode also answers when the page has no data-theme (ADR 0005, section 2).
 */
export function buildSegmentedCss(modes: ModeDefinition[]): string {
  const scopes = modes.map(({ id }) => ({ id, scope: `[data-theme="${id}"]` }))
  scopes.push({ id: modes[0]!.id, scope: ':root:not([data-theme])' })
  const selectors = (pick: (id: string) => string, suffix = ''): string => scopes.map(({ id, scope }) => `${scope} ${pick(id)}${suffix}`).join(',\n')
  const rules = [`${selectors(id => `.bd-seg[data-mode="${id}"]`)} {\n  background: var(--ink);\n  color: var(--on-ink);\n}`]
  if (modes.length > 1) {
    const idle = (id: string): string => `.bd-seg[data-mode]:not([data-mode="${id}"])`
    rules.push(`${selectors(idle)} {\n  background: transparent;\n  color: var(--ink-muted);\n}`)
    rules.push(`${selectors(idle, ':hover')} {\n  color: var(--ink);\n}`)
  }
  return `${rules.join('\n')}\n`
}

// The init script, the segmented-control rules and the mode checks all come from the theme's modes
export function setupModes(ctx: ThemeContext): void {
  ctx.validators.push(validateModes)
  // Built once at setup (one hash per build): a change to the modes needs a dev restart
  const modes = ctx.load().manifest.modes
  const scripts = (ctx.nuxt.options.app.head.script ||= [])
  scripts.push({ innerHTML: buildInitScript(modes), tagPosition: 'head', tagPriority: 'critical' })
  ctx.componentsCss.push(() => buildSegmentedCss(ctx.load().manifest.modes))
}
