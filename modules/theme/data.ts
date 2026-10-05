import { join } from 'node:path'
import { addComponent, addTemplate, addTypeTemplate } from 'nuxt/kit'
import type { ThemeContext } from './context'

// Active theme's id at build time; the server plugin compares it with the runtime value
const BUILD_THEME_MODULE = '#micelio/build-theme'

export const LAYOUT_REGIONS = ['header', 'home', 'postList', 'article', 'footer'] as const
export type LayoutRegion = typeof LAYOUT_REGIONS[number]

export const SLOT_NAMES = ['ThemeMark', 'ThemeHero', 'ThemeDivider', 'ThemeEmptyState', 'ThemeIllustration'] as const
export type SlotName = typeof SLOT_NAMES[number]

export interface SlotOptions {
  island?: boolean
}

/** A mode as the theme declares it (the module's own type; the app's `ThemeMode` is a mode id). */
export interface ModeDefinition {
  id: string
  scheme: 'dark' | 'light'
  name?: string
}

/** Variant each region renders when the theme does not name one. */
export const DEFAULT_LAYOUT: Record<LayoutRegion, string> = {
  header: 'bar',
  home: 'showcase',
  postList: 'grid',
  article: 'aside',
  footer: 'columns',
}

export function setupData(ctx: ThemeContext): void {
  const { nuxt } = ctx
  nuxt.options.runtimeConfig.public.theme = ctx.id

  function themeData(): object {
    const { id, modes, fonts, layout, slots } = ctx.load().manifest
    return {
      id,
      modes: modes.map(({ id, scheme, name }: ModeDefinition) => ({ id, scheme, name })),
      fonts: fonts ?? [],
      layout: { ...DEFAULT_LAYOUT, ...layout },
      slots: slots ?? {},
    }
  }
  nuxt.options.alias['#micelio/theme'] = join(nuxt.options.buildDir, 'micelio/theme.mjs')
  addTemplate({
    filename: 'micelio/theme.mjs',
    write: true,
    getContents: () => `const theme = ${JSON.stringify(themeData(), null, 2)}\nexport const { id, modes, fonts, layout, slots } = theme\nexport default theme\n`,
  })
  addTypeTemplate({
    filename: 'types/micelio-theme.d.ts',
    getContents: () => `declare module '#micelio/theme' {
  export interface ModeDefinition {
    id: string
    scheme: 'dark' | 'light'
    name?: string
  }
  export interface ThemeFont {
    family: string
    file: string
    preload?: boolean
  }
  export type LayoutRegion = ${LAYOUT_REGIONS.map(region => `'${region}'`).join(' | ')}
  export type SlotName = ${SLOT_NAMES.map(name => `'${name}'`).join(' | ')}
  export interface SlotOptions {
    island?: boolean
  }
  export interface ActiveTheme {
    id: string
    modes: ModeDefinition[]
    fonts: ThemeFont[]
    layout: Record<LayoutRegion, string>
    slots: Partial<Record<SlotName, SlotOptions>>
  }
  export const id: string
  export const modes: ModeDefinition[]
  export const fonts: ThemeFont[]
  export const layout: Record<LayoutRegion, string>
  export const slots: Partial<Record<SlotName, SlotOptions>>
  const theme: ActiveTheme
  export default theme
}

declare module '${BUILD_THEME_MODULE}' {
  export const buildTheme: string
}
`,
  }, { nitro: true, nuxt: true })

  nuxt.hook('nitro:config', (config) => {
    config.virtual ||= {}
    config.virtual[BUILD_THEME_MODULE] = `export const buildTheme = ${JSON.stringify(ctx.id)}`
  })
}

/** Registers what modes.ts, slots.ts and layout/* pushed to ctx.components (call it after them). */
export function setupComponents(ctx: ThemeContext): void {
  for (const component of ctx.components) addComponent(component)
}
