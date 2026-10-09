import type { Nuxt } from '@nuxt/schema'
import type { ThemeData } from './tokens.mjs'
import type { LAYOUT_REGIONS, SLOT_NAMES } from './constants'

/** A region of the page whose layout variant a theme can choose. */
export type LayoutRegion = typeof LAYOUT_REGIONS[number]

/** A slot a theme can fill with its own component. */
export type SlotName = typeof SLOT_NAMES[number]

/** How a slot component is rendered. */
export interface SlotOptions {
  /** Render the component as a client island instead of static markup. */
  island?: boolean
}

/** A font file a theme ships and the family it provides. */
export interface ThemeFont {
  family: string
  file: string
  preload?: boolean
}

/** A `theme.json` as read from disk, before or after validation against the contract. */
export interface ThemeManifest extends ThemeData {
  id: string
  contract: number
  fonts?: ThemeFont[]
  images?: Partial<Record<'favicon' | 'ogImage' | 'profile', string>>
  layout?: Partial<Record<LayoutRegion, string>>
  slots?: Partial<Record<SlotName, SlotOptions>>
  mermaid?: Record<string, string>
}

/** A theme found on disk: its id, its directory and its manifest. */
export interface InstalledTheme {
  id: string
  dir: string
  manifest: ThemeManifest
}

/** The public hooks of the core (`app/theme/hooks.json`). */
export interface Hooks {
  classes: ReadonlySet<string>
  attributes: ReadonlySet<string>
}

/** One contrast requirement of ADR 0005, section 1. */
export interface ContrastRule {
  /** The foreground role. */
  role: string
  /** The roles it sits on. */
  surfaces: string[]
  /** The minimum WCAG contrast ratio. */
  min: number
}

/** A piece of generated CSS, evaluated each time its template is rebuilt. */
export type CssSource = () => string

/** A theme component registered with Nuxt. */
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
