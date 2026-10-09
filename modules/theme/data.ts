import { join } from 'node:path'
import { addComponent, addTemplate, addTypeTemplate, useLogger } from 'nuxt/kit'
import type { LayoutRegion, SlotName, ThemeContext } from './types'
import { LAYOUT_REGIONS, SLOT_NAMES } from './constants'
import { buildPalette } from './palette'

/** Where the theme's images are served: /theme/images/<file> (docs/adr/0005-theme-contract.md). */
export const IMAGES_URL = 'theme/images'

// Active theme's id at build time; the server plugin compares it with the runtime value
const BUILD_THEME_MODULE = '#micelio/build-theme'
// Nitro only: the active theme's resolved palette, for the server's contrast math
const PALETTE_MODULE = '#micelio/theme-palette'

export interface SlotProp {
  name: string
  /** TypeScript type, as text. */
  type: string
  optional: boolean
  description: string
}

export interface SlotSpec {
  purpose: string
  props: SlotProp[]
  /** What the core renders when the theme ships no file (app/theme/defaults/). */
  defaultRenders: string
}

/** Contract of each slot (ADR 0005, section 4); the theme reference is generated from it and a test compares the props with the defaults. */
export const SLOT_SPECS: Record<SlotName, SlotSpec> = {
  ThemeMark: {
    purpose: 'The site logo or wordmark, in the header and the footer.',
    props: [
      { name: 'size', type: 'number', optional: true, description: 'Height in px the core passes: 30 in the header, 56 in the `columns` footer, 32 in the `minimal` footer.' },
      { name: 'context', type: '\'header\' | \'footer\'', optional: true, description: 'Where the mark is rendered.' },
    ],
    defaultRenders: 'The site name as text (`aria-hidden`).',
  },
  ThemeHero: {
    purpose: 'Art of the `showcase` home hero. The core renders it twice, each with its own box set by the caller\'s class.',
    props: [{ name: 'compact', type: 'boolean', optional: true, description: 'False: the full art, 760 x 720 px from 1024px up. True: the compact box, 390 x 300 px below the copy on smaller screens.' }],
    defaultRenders: 'An empty decorative `div` (`aria-hidden`); the caller\'s class gives it the hero art\'s box.',
  },
  ThemeDivider: {
    purpose: 'Decoration inside the `columns` footer, between the link columns and the credits.',
    props: [{ name: 'placement', type: '\'footer\'', optional: true, description: 'Where it renders; the core only renders it in the footer.' }],
    defaultRenders: 'Nothing.',
  },
  ThemeEmptyState: {
    purpose: 'Wrapper of an empty state (no articles, no results). It receives the accent of its picture as the `--empty-accent` custom property, which is unset in the blog list\'s empty state: fall back, for example `var(--empty-accent, var(--accent))`.',
    props: [],
    defaultRenders: 'A `div` around the default slot content.',
  },
  ThemeIllustration: {
    purpose: 'Illustration of a category on the topic cards of the home guide and of topic blocks.',
    props: [
      { name: 'category', type: 'Category', optional: false, description: 'The category slug; `categoryColor(category)` gives its color role.' },
      { name: 'size', type: 'number', optional: true, description: 'Width in px; the core passes 200.' },
    ],
    defaultRenders: 'Nothing.',
  },
  ThemeProgressMarker: {
    purpose: 'Marker that travels along the reading-progress bar of an article, inside `myc-progress`; the slot renders its own `myc-progress-track` lane.',
    props: [{ name: 'progress', type: 'number', optional: true, description: 'Reading progress, 0 to 100.' }],
    defaultRenders: 'Nothing; the header\'s progress bar alone remains.',
  },
  ThemeSupportArt: {
    purpose: 'Art of the support section. It renders inside the cup\'s `aria-hidden` SVG (`viewBox="0 0 120 100"`), so it returns SVG elements only.',
    props: [],
    defaultRenders: 'Nothing; the cup stays as it is.',
  },
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
  const logger = useLogger('micelio-theme')
  const paletteSource = join(nuxt.options.rootDir, 'modules/theme/palette')
  nuxt.options.runtimeConfig.public.theme = ctx.id

  function themeData(): object {
    const { id, modes, fonts, images, layout, slots } = ctx.load().manifest
    return {
      id,
      modes: modes.map(({ id, scheme, name }: ModeDefinition) => ({ id, scheme, name })),
      fonts: fonts ?? [],
      images: Object.fromEntries(Object.entries(images ?? {}).map(([role, file]) => [role, `/${IMAGES_URL}/${file}`])),
      layout: { ...DEFAULT_LAYOUT, ...layout },
      slots: slots ?? {},
    }
  }
  nuxt.options.alias['#micelio/theme'] = join(nuxt.options.buildDir, 'micelio/theme.mjs')
  addTemplate({
    filename: 'micelio/theme.mjs',
    write: true,
    getContents: () => `const theme = ${JSON.stringify(themeData(), null, 2)}\nexport const { id, modes, fonts, images, layout, slots } = theme\nexport default theme\n`,
  })
  // Apart from the theme data: only the article's rich text reads it, and the data is in every page's entry
  nuxt.options.alias['#micelio/theme-mermaid'] = join(nuxt.options.buildDir, 'micelio/theme-mermaid.mjs')
  addTemplate({
    filename: 'micelio/theme-mermaid.mjs',
    write: true,
    getContents: () => `export default ${JSON.stringify(ctx.load().manifest.mermaid ?? {})}\n`,
  })
  addTypeTemplate({
    filename: 'types/micelio-theme-mermaid.d.ts',
    getContents: () => `declare module '#micelio/theme-mermaid' {\n  const overrides: Record<string, string>\n  export default overrides\n}\n`,
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
  export interface ThemeImages {
    favicon?: string
    ogImage?: string
    profile?: string
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
    images: ThemeImages
    layout: Record<LayoutRegion, string>
    slots: Partial<Record<SlotName, SlotOptions>>
  }
  export const id: string
  export const modes: ModeDefinition[]
  export const fonts: ThemeFont[]
  export const images: ThemeImages
  export const layout: Record<LayoutRegion, string>
  export const slots: Partial<Record<SlotName, SlotOptions>>
  const theme: ActiveTheme
  export default theme
}

declare module '${PALETTE_MODULE}' {
  export type { ContrastRule } from '${paletteSource}'
  export type { ModePalette } from '${paletteSource}'
  export const modes: Record<string, import('${paletteSource}').ModePalette>
  export const rules: import('${paletteSource}').ContrastRule[]
}

declare module '${BUILD_THEME_MODULE}' {
  export const buildTheme: string
}
`,
  }, { nitro: true, nuxt: true })

  nuxt.hook('nitro:config', (config) => {
    config.virtual ||= {}
    config.virtual[BUILD_THEME_MODULE] = `export const buildTheme = ${JSON.stringify(ctx.id)}`
    // Built once, here: theme.json edits in dev need a restart. A mode that does not resolve is left out (contrast stays out of the build).
    const { modes, rules, skipped } = buildPalette(ctx.load().manifest)
    for (const { mode, reason } of skipped) logger.warn(`Theme "${ctx.id}", mode "${mode}": left out of the palette (${reason})`)
    config.virtual[PALETTE_MODULE] = `export const modes = ${JSON.stringify(modes)}\nexport const rules = ${JSON.stringify(rules)}\n`
  })
}

/** Registers what modes.ts, slots.ts and layout/* pushed to ctx.components (call it after them). */
export function setupComponents(ctx: ThemeContext): void {
  for (const component of ctx.components) addComponent(component)
}
