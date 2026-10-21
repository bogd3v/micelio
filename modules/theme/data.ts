import { addComponent, addTypeTemplate } from 'nuxt/kit'
import type { SlotName, ThemeContext } from './types'

// Active theme's id at build time; the server plugin compares it with the runtime value
const BUILD_THEME_MODULE = '#micelio/build-theme'

/** One prop of a slot component, as the theme reference documents it. */
export interface SlotProp {
  name: string
  /** TypeScript type, as text. */
  type: string
  optional: boolean
  description: string
}

/** The documented contract of one slot: its purpose, its props and what the core renders without a theme file. */
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
    purpose: 'Illustration of a category on the topic cards of the home guide and of topic blocks. Categories are data, so the slug can be one the theme never saw: render nothing (not whitespace, and not several root nodes) for a slug the theme has no art for, and the core hides the empty box.',
    props: [
      { name: 'category', type: 'string', optional: false, description: 'The slug of a category of the CMS. It can be any slug: the core knows none, so render a neutral fallback or nothing for a slug the theme has no art for.' },
      { name: 'color', type: 'string', optional: false, description: 'The category\'s color role, `var(--category-N)`, from the same ranking as its tag (`categoryColor`); the neutral `var(--ink-muted)` for a slug the list does not have. The core always passes it.' },
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

/**
 * Records the active theme's id for the build, and declares the virtual module that carries it into Nitro.
 *
 * @remarks
 * Runs at build time. Sets `runtimeConfig.public.theme` to the active id and adds the Nitro virtual module `#micelio/build-theme`,
 * which `server/plugins/runtimeConfigCheck.ts` compares with the runtime value until #401 removes that check. The theme's modes,
 * images, layout, fonts, palette and messages no longer come from here: they are compiled into the built-in store
 * (`built-in-store.ts`) and read from it at runtime (ADR 0009, section 6).
 */
export function setupData(ctx: ThemeContext): void {
  const { nuxt } = ctx
  nuxt.options.runtimeConfig.public.theme = ctx.id
  addTypeTemplate({
    filename: 'types/micelio-theme.d.ts',
    getContents: () => `declare module '${BUILD_THEME_MODULE}' {\n  export const buildTheme: string\n}\n`,
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
