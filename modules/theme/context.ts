import { resolve, sep } from 'node:path'
import type { Nuxt } from '@nuxt/schema'
import { updateTemplates } from 'nuxt/kit'
import { DEFAULT_THEME, discoverThemes, selectTheme, themeRoots } from './themes'
import type { InstalledTheme } from './themes'
import { loadHooks } from './hooks'
import { validateThemes } from './validate'
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
  /** Registered globally, for `resolveComponent` (the specimen's alternate variants). */
  global?: boolean
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
  /** Rules for `micelio/components.css` (myc.components, after segmented.css). */
  componentsCss: CssSource[]
  /** Rules for `micelio/theme.css` (myc.theme, after the theme's own theme.css). */
  slotCss: CssSource[]
  /** Rules for each region's template, at the position of the file it replaces. */
  layoutCss: Record<LayoutRegion, CssSource[]>
  /** Components to register (slots and layout variants); data.ts adds them with addComponent. */
  components: ThemeComponent[]
}

export function createContext(nuxt: Nuxt): ThemeContext {
  const id = process.env.NUXT_PUBLIC_THEME || nuxt.options.runtimeConfig.public.theme || DEFAULT_THEME
  const roots = themeRoots(nuxt.options.rootDir)
  // Discovery runs again on every regeneration, so editing a theme in dev needs no restart
  const hooks = loadHooks(nuxt.options.srcDir)
  // Every installed theme is validated, not only the active one (ADR 0005, section 6)
  const load = (): InstalledTheme => {
    const themes = discoverThemes(roots)
    validateThemes(themes, hooks)
    return selectTheme(themes, id)
  }
  const active = load()
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
  }
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
