/**
 * The five categories a post can belong to. Each value is the category's slug in the CMS.
 *
 * @public
 */
export enum Category {
  Privacy = 'privacidad',
  Diy = 'diy',
  Ai = 'ia',
  Software = 'software',
  Linux = 'linux',
}

/**
 * The visual style of a `MycButton`: primary, secondary, accent, or plain text.
 *
 * @public
 */
export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'text'

/**
 * The size of a `MycButton`: `md` or the compact `sm`.
 *
 * @public
 */
export type ButtonSize = 'md' | 'sm'

/**
 * The tone of a `MycCallout`: a note, a warning or a danger.
 *
 * @public
 */
export type CalloutTone = 'note' | 'warning' | 'danger'

/**
 * One line of a code block. A line that starts with a prompt (`$ `) has `prompt` set and the prompt removed from `text`.
 *
 * @public
 */
export interface CodeLine {
  prompt: boolean
  text: string
}

/**
 * The editorial data of a category, from `CATEGORY_INFO`.
 *
 * @public
 */
export interface CategoryInfo {
  /** The home page field guide pillar (1 or 2) of the two categories that have one; null for the others. */
  pillar: 1 | 2 | null
}

/**
 * A category with the number of posts in it, as the categories API returns it.
 *
 * @public
 */
export interface CategoryCount {
  id: number
  slug: string | null
  name: string
  /** Number of posts in the category. */
  count: number
}

/**
 * The name and slug of a category as the CMS returns it; either may be missing.
 *
 * @public
 */
export interface CategoryLike {
  name?: string | null
  slug?: string | null
}

/**
 * The state of the newsletter form after a submit.
 *
 * @public
 */
export type NewsletterStatus = 'idle' | 'success' | 'error'

/**
 * The outcome of a newsletter sign-up, for the form to show.
 *
 * @public
 */
export interface NewsletterResult {
  status: NewsletterStatus
  message: string
  /** True when the address was rejected as malformed, so the form marks the field. */
  invalid: boolean
}

/**
 * The props of `MycPostCard`, a post in a list.
 *
 * @public
 */
export interface PostCardProps {
  title: string
  /** Names the card in the view transition to its article */
  slug?: string
  href: string
  /** A plain-text summary, shown when there is no search snippet. */
  excerpt?: string
  /** A text fragment around the search match, shown with the match highlighted instead of the excerpt. */
  snippet?: string
  category?: Category
  /** The formatted date shown on the card. */
  date?: string
  /** The machine-readable date for the `datetime` attribute of the `<time>` element. */
  dateTime?: string
  author?: string
  /** The reading time shown on the card, already translated. */
  readTime?: string
  /** URL of the cover image. */
  image?: string
  imageAlt?: string
  /** Marks the post as read by the visitor, with a check mark. */
  read?: boolean
}

/**
 * A section of the site header that can be marked as the current one.
 *
 * @public
 */
export type HeaderSection = 'home' | 'blog' | 'about'

/**
 * A link of the standard header navigation.
 *
 * @public
 */
export interface NavLink {
  id: HeaderSection
  label: string
  to: string
  /** Never set on a standard link; only `LandingNavLink` uses it. */
  anchor?: never
  /** Never set on a standard link; only `LandingNavLink` uses it. */
  action?: never
}

/**
 * A landing's link: an anchor to a section of the home page (a plain `<a>`: the router would mark every one current), or a link of its hero or call to action.
 *
 * @public
 */
export interface LandingNavLink {
  id: string
  label: string
  to: string
  anchor?: boolean
  action?: boolean
}

/**
 * A navigation link of either kind: the standard header links or a landing's links.
 *
 * @public
 */
export type SiteNavLink = NavLink | LandingNavLink

/**
 * What a search palette option is: an article, a topic (category) or an action.
 *
 * @public
 */
export type PaletteKind = 'article' | 'topic' | 'action'

/**
 * The actions the search palette offers: switch the theme, or follow the site on the fediverse.
 *
 * @public
 */
export type PaletteAction = 'theme' | 'fediverse'

/**
 * A piece of a text split at the search matches; `match` marks the highlighted pieces.
 *
 * @public
 */
export interface TextSegment {
  text: string
  match: boolean
}

/**
 * One entry of the search palette.
 *
 * @public
 */
export interface PaletteOption {
  id: string
  kind: PaletteKind
  label: string
  /** A text fragment with the search match. */
  snippet?: string
  /** A short side text, such as a date or a post count. */
  hint?: string
  /** The CSS colour of the entry's marker, as a role such as `var(--link)`. */
  color?: string
  /** The route the entry opens. */
  to?: string
  /** The action to run instead of opening a route. */
  action?: PaletteAction
}

/**
 * The options of one kind, shown together under a heading in the search palette.
 *
 * @public
 */
export interface PaletteGroup {
  kind: PaletteKind
  options: PaletteOption[]
}

/**
 * Parameters of a generated contour-line illustration. No code in this repository reads them yet.
 */
export interface ContourOptions {
  cx: number
  cy: number
  from: number
  to: number
  step: number
  seed: number
  scaleX: number
  scaleY: number
}

/**
 * One closed ring of a contour illustration: its SVG path data and whether it is a major line. No code in this repository reads it yet.
 */
export interface ContourRing {
  d: string
  major: boolean
}

/**
 * A named contour illustration with its size and the options that generated it. No code in this repository reads it yet.
 */
export interface ContourSet {
  name: string
  width: number
  height: number
  options: ContourOptions
}

/**
 * A category shown in the home page field guide, with its post count.
 *
 * @public
 */
export interface FieldGuideTopic {
  category: Category
  count: number
}

/**
 * Why a fediverse instance name was rejected: it is `empty`, or `invalid`.
 *
 * @public
 */
export type InstanceError = 'empty' | 'invalid'

/**
 * The result of normalising a fediverse instance name: the bare host name, or the reason it was rejected.
 *
 * @public
 */
export interface InstanceResult {
  /** The host name, when the input is valid. */
  domain?: string
  error?: InstanceError
}
