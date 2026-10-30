import { resolve, sep } from 'node:path'
import type { Nuxt } from '@nuxt/schema'
import { updateTemplates } from 'nuxt/kit'
import { DEFAULT_THEME, activeTheme, discoverThemes, themeRoots } from './themes'
import { readLock } from './registry/lock'
import type { InstalledTheme, ThemeContext, CssSource, LayoutRegion } from './types'
import { loadHooks } from './hooks'
import { validateThemes } from './validate'
import { LAYOUT_REGIONS } from './constants'

declare module '@nuxt/schema' {
  interface PublicRuntimeConfig {
    theme: string
  }
}

/**
 * Discovers and validates every installed theme, and returns the context of the active one.
 *
 * @remarks
 * The active theme is `NUXT_PUBLIC_THEME`, else the public runtime config, else `DEFAULT_THEME`. Every installed theme is
 * validated, not only the active one (ADR 0005, section 6). The returned `load` runs discovery and validation again, so a
 * regeneration in dev sees the edits made to a theme.
 *
 * `nuxt prepare` and type checks (`_prepare`) use the starter when no theme is named and the default is not installed yet (`activeTheme`);
 * `nuxt dev` and `nuxt build` fail and say to run `theme:pull` or to use the starter.
 *
 * @throws `Error` when an installed theme is invalid, or the active theme is not installed; the message names each problem.
 */
export function createContext(nuxt: Nuxt): ThemeContext {
  const named = process.env.NUXT_PUBLIC_THEME || nuxt.options.runtimeConfig.public.theme
  const id = named || DEFAULT_THEME
  const roots = themeRoots(nuxt.options.rootDir)
  // Discovery runs again on every regeneration, so editing a theme in dev needs no restart
  const hooks = loadHooks(nuxt.options.srcDir)
  // Every installed theme is validated, not only the active one (ADR 0005, section 6)
  const load = (): InstalledTheme => {
    const themes = discoverThemes(roots)
    validateThemes(themes, hooks)
    return activeTheme(themes, id, { named: Boolean(named), prepare: Boolean(nuxt.options._prepare), locked: Object.keys(readLock(nuxt.options.rootDir)) })
  }
  const active = load()
  return {
    nuxt,
    id: active.id,
    roots,
    dir: active.dir,
    load,
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
