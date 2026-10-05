import { resolve, sep } from 'node:path'
import type { Nuxt } from '@nuxt/schema'
import { updateTemplates } from 'nuxt/kit'
import { DEFAULT_THEME, discoverThemes, selectTheme, themeRoots } from './themes'
import type { InstalledTheme, ThemeValidator } from './themes'
import { LAYOUT_REGIONS } from './data'
import type { LayoutRegion } from './data'

declare module '@nuxt/schema' {
  interface PublicRuntimeConfig {
    theme: string
  }
}

/** A piece of generated CSS, evaluated each time its template is rebuilt. */
export type CssSource = () => string

export interface ThemeComponent {
  name: string
  filePath: string
}

/** What the setup files share: the active theme, and the lists that css.ts turns into templates. */
export interface ThemeContext {
  nuxt: Nuxt
  /** Id of the active theme at build time. */
  id: string
  roots: string[]
  /** The active theme's directory. */
  dir: string
  /** Reads the active theme again (discovery runs on every regeneration). */
  load: () => InstalledTheme
  /** Rules for `micelio/components.css` (bd.components, after segmented.css). */
  componentsCss: CssSource[]
  /** Rules for `micelio/theme.css` (bd.theme, after the theme's own theme.css). */
  slotCss: CssSource[]
  /** Rules for each region's template, at the position of the file it replaces. */
  layoutCss: Record<LayoutRegion, CssSource[]>
  /** Components to register (slots and layout variants); data.ts adds them with addComponent. */
  components: ThemeComponent[]
  /** Checks of the active theme's manifest; registered by modes.ts, slots.ts and layout/*, run by validateTheme(). */
  validators: ThemeValidator[]
}

export function createContext(nuxt: Nuxt): ThemeContext {
  const id = process.env.NUXT_PUBLIC_THEME || nuxt.options.runtimeConfig.public.theme || DEFAULT_THEME
  const roots = themeRoots(nuxt.options.rootDir)
  // Discovery runs again on every regeneration, so editing a theme in dev needs no restart
  const validators: ThemeValidator[] = []
  const discover = (): InstalledTheme => selectTheme(discoverThemes(roots), id)
  const load = (): InstalledTheme => {
    const theme = discover()
    for (const validate of validators) validate(theme.manifest, theme.dir)
    return theme
  }
  const active = discover()
  return {
    nuxt,
    id: active.id,
    roots,
    dir: active.dir,
    load,
    componentsCss: [],
    slotCss: [],
    layoutCss: Object.fromEntries(LAYOUT_REGIONS.map(region => [region, []])) as unknown as Record<LayoutRegion, CssSource[]>,
    components: [],
    validators,
  }
}

/** Validates the active theme once every setup file has registered its checks; load() repeats it on each regeneration. */
export function validateTheme(ctx: ThemeContext): void {
  ctx.load()
}

/** True when `path` (absolute, or relative to srcDir or rootDir) is inside a theme root. */
export function isThemePath(ctx: ThemeContext, path: string): boolean {
  const absolute = [resolve(ctx.nuxt.options.srcDir, path), resolve(ctx.nuxt.options.rootDir, path)]
  return ctx.roots.some(root => absolute.some(file => file === root || file.startsWith(root + sep)))
}

/** A change under a theme directory regenerates the `micelio/` templates. */
export function setupWatch(ctx: ThemeContext): void {
  ctx.nuxt.options.watch.push(...ctx.roots)
  ctx.nuxt.hook('builder:watch', async (_event, path) => {
    if (!isThemePath(ctx, path)) return
    await updateTemplates({ filter: template => template.filename.startsWith('micelio/') })
  })
}
