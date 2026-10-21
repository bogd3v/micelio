import { buildInitScript } from './init-script.mjs'
import type { ModeDefinition, ThemeContext } from './types'

/**
 * Pressed and idle look of the mode switch for each mode, before hydration sets aria-pressed.
 * The first mode also answers when the page has no data-theme (ADR 0005, section 2).
 */
export function buildSegmentedCss(modes: ModeDefinition[]): string {
  const scopes = modes.map(({ id }) => ({ id, scope: `[data-theme="${id}"]` }))
  scopes.push({ id: modes[0]!.id, scope: ':root:not([data-theme])' })
  const selectors = (pick: (id: string) => string, suffix = ''): string => scopes.map(({ id, scope }) => `${scope} ${pick(id)}${suffix}`).join(',\n')
  const pressed = selectors(id => `.myc-seg[data-mode="${id}"]`)
  const rules = [`${pressed} {\n  background: var(--ink);\n  color: var(--on-ink);\n}`]
  // Same as .myc-seg[aria-pressed="true"] in segmented.css, which these selectors outrank
  rules.push(`@media (forced-colors: active) {\n${pressed} {\n  background: Highlight;\n  color: HighlightText;\n}\n}`)
  if (modes.length > 1) {
    const idle = (id: string): string => `.myc-seg[data-mode]:not([data-mode="${id}"])`
    rules.push(`${selectors(idle)} {\n  background: transparent;\n  color: var(--ink-muted);\n}`)
    rules.push(`${selectors(idle, ':hover')} {\n  color: var(--ink);\n}`)
  }
  return `${rules.join('\n')}\n`
}

/**
 * Adds the inline init script, the same for every theme.
 *
 * @remarks
 * Runs at build time. The init script goes into the `<head>` as a critical inline script on every page; its CSP hash is
 * fixed per core build (ADR 0004, ADR 0009 section 6) and the modes reach it through `data-modes` on `<html>`.
 */
export function setupModes(ctx: ThemeContext): void {
  const scripts = (ctx.nuxt.options.app.head.script ||= [])
  scripts.push({ innerHTML: buildInitScript(), tagPosition: 'head', tagPriority: 'critical' })
}
