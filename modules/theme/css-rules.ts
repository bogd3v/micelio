import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { transform } from 'lightningcss'
import { readThemeFile } from './files'
import type { Hooks } from './types'

// ADR 0005, sections 4 and 5: a theme's CSS selects public hooks only and loads nothing from outside its package

// TODO(#422): remove the bd- transition messages after one release line
/** The prefix the core used before the rename; a theme written for it gets the new name in the message. */
const LEGACY_PREFIX = 'bd-'
const MYC_PREFIX = 'myc-'

const REMOTE = /^([a-z][a-z0-9+.-]*:)?\/\//i

interface CssRuleContext {
  themeId: string
  themeDir: string
  hooks: Hooks
}

/** Selector components hold nested selectors under different keys (:is, :not, :has, :host(), ::slotted(), nth-child of …): walk them all. */
function selectorProblems(node: unknown, ctx: CssRuleContext, found: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) selectorProblems(item, ctx, found)
    return
  }
  if (!node || typeof node !== 'object') return
  const component = node as Record<string, unknown>
  if (component.type === 'class' && typeof component.name === 'string' && component.name.startsWith(LEGACY_PREFIX)) {
    const renamed = `${MYC_PREFIX}${component.name.slice(LEGACY_PREFIX.length)}`
    const notHook = ctx.hooks.classes.has(renamed) ? '' : `; ".${renamed}" is not a public hook either`
    found.add(`".${component.name}" was renamed ".${renamed}"${notHook} (ADR 0005, amendment of 2026-10-08)`)
  } else if (component.type === 'class' && typeof component.name === 'string' && component.name.startsWith(MYC_PREFIX) && !ctx.hooks.classes.has(component.name)) {
    found.add(`".${component.name}" is not a public hook (internal myc-* classes can change in any release)`)
  } else if (component.type === 'attribute' && typeof component.name === 'string') {
    const name = component.name.toLowerCase()
    const operation = component.operation as { value?: unknown } | null
    if (name.startsWith(`data-${LEGACY_PREFIX}`)) {
      found.add(`"[${name}]" was renamed "[data-${MYC_PREFIX}${name.slice(`data-${LEGACY_PREFIX}`.length)}]" (ADR 0005, amendment of 2026-10-08)`)
    } else if (name.startsWith('data-') && !ctx.hooks.attributes.has(name) && !name.startsWith(`data-${ctx.themeId}-`)) {
      found.add(`"[${name}]" is not a public hook (a theme's own attributes start with data-${ctx.themeId}-)`)
    } else if (name === 'class' && typeof operation?.value === 'string' && /\bbd-/i.test(operation.value)) {
      found.add(`[class …"${operation.value}"] matches classes that were renamed from bd-* to myc-*; select a public hook class instead (ADR 0005, amendment of 2026-10-08)`)
    } else if (name === 'class' && typeof operation?.value === 'string' && /\bmyc-/i.test(operation.value)) {
      found.add(`[class …"${operation.value}"] matches internal myc-* classes; select a public hook class instead`)
    }
  }
  for (const value of Object.values(component)) selectorProblems(value, ctx, found)
}

/** Functions whose string arguments are URLs. */
const URL_FUNCTIONS = new Set(['image-set', '-webkit-image-set', 'src', 'image', 'cross-fade', '-webkit-cross-fade'])

function collectStrings(value: unknown, urls: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, urls)
  } else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (record.type === 'string' && typeof record.value === 'string') urls.add(record.value)
    for (const item of Object.values(record)) collectStrings(item, urls)
  }
}

/** Every URL in a parsed value: url() tokens, and the strings inside image-set(), src() and similar, also in custom properties. */
function collectUrls(value: unknown, urls: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectUrls(item, urls)
  } else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.url === 'string') urls.add(record.url)
    if (typeof record.name === 'string' && URL_FUNCTIONS.has(record.name.toLowerCase()) && 'arguments' in record) collectStrings(record.arguments, urls)
    for (const item of Object.values(record)) collectUrls(item, urls)
  }
}

/** A url() path the theme may load: its own fonts and images, without dot segments, backslashes or encoded dots. */
export function urlAllowed(url: string): boolean {
  if (url.startsWith('#')) return true
  let decoded: string
  try {
    decoded = decodeURIComponent(url)
  } catch {
    return false
  }
  if (/%2e|%2f|%5c/i.test(url) || /%2e|%2f|%5c|\\/i.test(decoded)) return false
  if (decoded.split('/').some(segment => segment === '..' || segment === '.')) return false
  return /^\/(fonts|theme\/images)\//.test(decoded)
}

/** Problems of one stylesheet, and the local files it imports (checked in turn by checkThemeCss). */
export function checkCss(code: string, file: string, ctx: CssRuleContext): { problems: string[], imports: string[] } {
  const found = new Set<string>()
  const urls = new Set<string>()
  const imports: string[] = []
  const important = new Set<string>()
  try {
    transform({
      filename: file,
      code: Buffer.from(code),
      errorRecovery: false,
      visitor: {
        Selector(selector) {
          selectorProblems(selector, ctx, found)
          return undefined
        },
        Rule: {
          style(rule) {
            for (const declaration of rule.value.declarations?.importantDeclarations ?? []) important.add(String(declaration.property === 'custom' ? (declaration.value as { name: string }).name : declaration.property))
            return undefined
          },
          property(rule) {
            collectUrls(rule.value, urls)
            return undefined
          },
          import(rule) {
            const url = rule.value.url
            if (REMOTE.test(url)) found.add(`@import "${url}" is remote; a theme loads nothing from other origins`)
            else imports.push(url)
            return undefined
          },
        },
        Declaration(declaration) {
          collectUrls(declaration, urls)
          return undefined
        },
        Url(url) {
          urls.add(url.url)
          return undefined
        },
      },
    })
  } catch (error) {
    return { problems: [`${file}: cannot parse the CSS: ${(error as Error).message}`], imports }
  }
  for (const property of important) found.add(`!important on "${property}" is not allowed (themes sit in a cascade layer instead)`)
  for (const url of urls) {
    if (!urlAllowed(url)) found.add(`url(${url}) is outside the theme's fonts/ and images/ (allowed: /fonts/… and /theme/images/…, without .. or encoded dots)`)
  }
  return { problems: [...found].map(problem => `${file}: ${problem}`), imports }
}

/** The stylesheets a theme ships: theme.css, sections.css, the font faces and slots/*.css. */
export function themeCssFiles(themeDir: string): string[] {
  const slots = join(themeDir, 'slots')
  return [
    ...['theme.css', 'sections.css', 'fonts.css', 'font-fallbacks.css'].map(file => join(themeDir, file)),
    ...(existsSync(slots) ? readdirSync(slots).filter(file => file.endsWith('.css')).sort().map(file => join(slots, file)) : []),
  ].filter(file => existsSync(file))
}

/** Every problem in the theme's CSS, following local @imports inside the theme folder. */
export function checkThemeCss(ctx: CssRuleContext): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  const queue = themeCssFiles(ctx.themeDir)
  while (queue.length) {
    const path = queue.shift()!
    if (seen.has(path)) continue
    seen.add(path)
    const name = relative(ctx.themeDir, path)
    const file = readThemeFile(ctx.themeDir, path)
    if ('problem' in file) {
      problems.push(file.problem)
      continue
    }
    const result = checkCss(file.text, name, ctx)
    problems.push(...result.problems)
    for (const url of result.imports) {
      const target = resolve(dirname(path), url)
      if (target !== ctx.themeDir && !target.startsWith(ctx.themeDir + sep)) problems.push(`${name}: @import "${url}" leaves the theme folder`)
      else if (!existsSync(target)) problems.push(`${name}: @import "${url}" does not exist`)
      else queue.push(target)
    }
  }
  return problems
}
