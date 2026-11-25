import type { IconSymbolCarrier } from './icons'
import type { BlockOptions, BlockOptionValue } from './block-options'
import type { Locale } from './locale'
import type { PostListItem, PostTranslation } from './strapi-post'

/**
 * The section components a page can render, by their name without the `section.` prefix.
 *
 * @remarks
 * The `prose` block of the catalogue, `shared.rich-text`, is rendered by a page too (`ProseSection`) and is not in this list, since its CMS component is not a `section.*` one. Sections of any other component are left out by the server. A page draft also keeps its Playground blocks, which no page renders (`DraftPlaygroundSection`).
 *
 * @public
 */
export const PAGE_SECTION_COMPONENTS = [
  'hero', 'feature-grid', 'media-showcase', 'stats', 'logo-cloud', 'testimonials', 'pricing',
  'faq', 'cta', 'post-list', 'newsletter', 'rich-text', 'gallery', 'scene',
] as const

/**
 * The name of a section component, one of `PAGE_SECTION_COMPONENTS`, without the `section.` prefix.
 *
 * @public
 */
export type PageSectionKind = typeof PAGE_SECTION_COMPONENTS[number]

/**
 * An image, a video or a 3D model file of a page section, validated by the server.
 *
 * @public
 */
export interface PageMedia {
  /** A `/uploads/` path, or an http(s) URL on the CMS or a configured media origin. */
  url: string
  /** Alternative text, trimmed; absent when the editor left it empty. */
  alternativeText?: string
  /** Intrinsic width in pixels, when Strapi knows it. */
  width?: number
  /** Intrinsic height in pixels, when Strapi knows it. */
  height?: number
  /** MIME type of the file, when Strapi knows it. */
  mime?: string
}

/**
 * A link of a page section, to another page or to an external address.
 *
 * @public
 */
export interface PageLink {
  label: string
  /** An http(s) or `mailto:` URL, or a path on the site. */
  url: string
}

/**
 * The search and share metadata of a page, validated by the server.
 *
 * @public
 */
export interface PageSeo {
  metaTitle: string
  metaDescription: string
  /** The image of the share preview. */
  metaImage?: PageMedia
  /** Comma-separated robots directives; only the directives Google documents pass. */
  metaRobots?: string
  keywords?: string
  /** An absolute http(s) URL on the site's own origin; any other value is dropped. */
  canonicalURL?: string
}

interface SectionBase<K extends PageSectionKind> {
  __component: `section.${K}`
  /** The stable id of this block instance, opaque and unique in its page; absent in content stored before the CMS generated ids. Renderers key by it and fall back to the position. */
  blockId?: string
}

/**
 * The group key of a page section (ADR 0022, section 2): consecutive blocks that share a `groupId` form one band on the surface of its `tone`.
 *
 * @remarks
 * One level: a member is never a group. The CMS refuses a save where a `groupId` is in two runs or its members differ in `tone`; stored content is not re-checked, so a renderer must not assume it. A member's own `tone` option is ignored while it is in the group. The server drops a key with no `groupId` or an unknown `tone`, and the block stays, outside any group.
 *
 * @public
 */
export interface SectionGroup {
  /** An opaque string, unique in the page; blocks that share it form one group. */
  groupId: string
  /** The group's surface, a value of the `tone` option (`BLOCK_OPTIONS.tone`). */
  tone: BlockOptionValue<'tone'>
}

/**
 * The optional `group` key of a page section. `rich-text`, `prose` and the article blocks take none.
 *
 * @public
 */
export interface SectionGroupFields {
  group?: SectionGroup
}

/**
 * The two optional fields of a section that renders a heading: a short label above the title and an explicit anchor.
 *
 * @remarks
 * The anchor is a kebab-case slug the CMS keeps unique in the page, never derived from the title. With one, the heading carries `id="<anchor>"` and a self-link; without one the section renders as before.
 *
 * @public
 */
export interface SectionHeadFields {
  /** A short label above the title. */
  eyebrow?: string
  /** The id of the heading and the target of its self-link. */
  anchor?: string
}

/**
 * The opening section of a page, `section.hero`: a title, an optional text, up to two links and a media.
 *
 * @public
 */
export interface HeroSection extends SectionBase<'hero'>, SectionGroupFields, SectionHeadFields, BlockOptions<'section.hero'> {
  variant: 'centered' | 'split' | 'full-bleed'
  title: string
  text?: string
  primaryLink?: PageLink
  secondaryLink?: PageLink
  media?: PageMedia
}

/**
 * One feature of a `FeatureGridSection`, `section.feature-item`.
 *
 * @public
 */
export interface FeatureItem {
  /** The stable id of this item, opaque and unique in its block; absent in content stored before the CMS generated ids. */
  itemId?: string
  icon?: PageMedia
  title: string
  text?: string
}

/**
 * A grid, a list or a bento layout of features, `section.feature-grid`.
 *
 * @public
 */
export interface FeatureGridSection extends SectionBase<'feature-grid'>, SectionGroupFields, SectionHeadFields, BlockOptions<'section.feature-grid'> {
  variant: 'grid' | 'list' | 'bento'
  title?: string
  text?: string
  items: FeatureItem[]
}

/**
 * A media file with a text beside it, `section.media-showcase`.
 *
 * @public
 */
export interface MediaShowcaseSection extends SectionBase<'media-showcase'>, SectionGroupFields, BlockOptions<'section.media-showcase'> {
  variant: 'left' | 'right' | 'stacked'
  title?: string
  /** Sanitized HTML of the Markdown text */
  html?: string
  media: PageMedia
  link?: PageLink
}

/**
 * One figure of a `StatsSection`, `section.stat`.
 *
 * @public
 */
export interface StatItem {
  /** The stable id of this item, opaque and unique in its block; absent in content stored before the CMS generated ids. */
  itemId?: string
  /** Shown as written; a string, so `12k` or `99%` need no conversion. */
  value: string
  label: string
}

/**
 * A row or a set of cards of figures, `section.stats`.
 *
 * @public
 */
export interface StatsSection extends SectionBase<'stats'>, SectionGroupFields, SectionHeadFields, BlockOptions<'section.stats'> {
  variant: 'row' | 'cards'
  title?: string
  items: StatItem[]
}

/**
 * One logo of a `LogoCloudSection`, `section.logo`.
 *
 * @public
 */
export interface LogoItem {
  /** The stable id of this item, opaque and unique in its block; absent in content stored before the CMS generated ids. */
  itemId?: string
  image: PageMedia
  name: string
  /** http(s) only */
  url?: string
}

/**
 * A row or a moving strip of logos, `section.logo-cloud`.
 *
 * @public
 */
export interface LogoCloudSection extends SectionBase<'logo-cloud'>, SectionGroupFields, SectionHeadFields, BlockOptions<'section.logo-cloud'> {
  variant: 'row' | 'marquee'
  title?: string
  logos: LogoItem[]
}

/**
 * One quote of a `TestimonialsSection`, `section.testimonial`.
 *
 * @public
 */
export interface TestimonialItem {
  /** The stable id of this item, opaque and unique in its block; absent in content stored before the CMS generated ids. */
  itemId?: string
  /** Plain text, not Markdown. */
  quote: string
  author: string
  role?: string
  avatar?: PageMedia
  /** Where the quotation was said or published: an `http(s)` URL, the `cite` attribute of its `<blockquote>`. */
  sourceUrl?: string
  /** The logo of the author's company. */
  logo?: PageMedia
  /** A whole number from 1 to 5, shown as text ("4 of 5"). A value outside the range never reaches the page. */
  rating?: number
}

/**
 * One quote or a grid of quotes, `section.testimonials`.
 *
 * @public
 */
export interface TestimonialsSection extends SectionBase<'testimonials'>, SectionGroupFields, SectionHeadFields, BlockOptions<'section.testimonials'> {
  variant: 'single' | 'grid'
  title?: string
  items: TestimonialItem[]
}

/**
 * One plan of a `PricingSection`, `section.plan`.
 *
 * @public
 */
export interface PricingPlan {
  /** The stable id of this item, opaque and unique in its block; absent in content stored before the CMS generated ids. */
  itemId?: string
  name: string
  price: string
  period?: string
  /** One feature per line in the CMS */
  features: string[]
  link?: PageLink
  recommended: boolean
}

/**
 * Plans as cards or as a comparison table, `section.pricing`.
 *
 * @public
 */
export interface PricingSection extends SectionBase<'pricing'>, SectionGroupFields, SectionHeadFields, BlockOptions<'section.pricing'> {
  variant: 'cards' | 'table'
  title?: string
  text?: string
  plans: PricingPlan[]
}

/**
 * One question of a `FaqSection`, `section.faq-item`.
 *
 * @public
 */
export interface FaqItem {
  /** The stable id of this item, opaque and unique in its block; absent in content stored before the CMS generated ids. */
  itemId?: string
  question: string
  /** Sanitized HTML of the Markdown answer */
  html: string
  /** The item is open when the page loads (`<details open>`); the server always sends it, a block built by hand may leave it out. */
  defaultOpen?: boolean
}

/**
 * A list of questions and answers, `section.faq`.
 *
 * @public
 */
export interface FaqSection extends SectionBase<'faq'>, SectionGroupFields, SectionHeadFields, BlockOptions<'section.faq'> {
  variant: 'list' | 'two-columns'
  title?: string
  items: FaqItem[]
}

/**
 * A call to action with up to two links, `section.cta`.
 *
 * @public
 */
export interface CtaSection extends SectionBase<'cta'>, SectionGroupFields, SectionHeadFields, BlockOptions<'section.cta'> {
  variant: 'banner' | 'card'
  title: string
  text?: string
  primaryLink?: PageLink
  secondaryLink?: PageLink
}

/**
 * A list of the newest published posts, optionally filtered by a category or a tag, `section.post-list`.
 *
 * @remarks
 * The server fills `posts` for the first four post lists of a page; the others render with none.
 *
 * @public
 */
export interface PostListSection extends SectionBase<'post-list'>, SectionGroupFields, SectionHeadFields, BlockOptions<'section.post-list'> {
  variant: 'cards' | 'list'
  title?: string
  /** Category or tag slug the list is filtered by; never both */
  category?: string
  tag?: string
  /** Number of posts to show, from 1 to 12; the CMS default is 3. */
  count: number
  /** Resolved on the server, newest first; empty when there are none */
  posts: PostListItem[]
}

/**
 * The newsletter sign-up form, `section.newsletter`.
 *
 * @public
 */
export interface NewsletterSection extends SectionBase<'newsletter'>, SectionGroupFields, SectionHeadFields, BlockOptions<'section.newsletter'> {
  variant: 'inline' | 'card'
  title?: string
  text?: string
  buttonLabel?: string
  /** The legal text a visitor accepts beside a required checkbox; empty renders neither the line nor the checkbox. There is no default: it is a node's own wording. */
  consentText?: string
  /** The sentence shown after a subscription; empty renders the core's own string. */
  successMessage?: string
  /** The hint of the address field; empty renders the core's own string. */
  placeholder?: string
}

/**
 * A text block written in Markdown, `section.rich-text`.
 *
 * @public
 */
export interface RichTextSection extends SectionBase<'rich-text'>, BlockOptions<'section.rich-text'> {
  /** Sanitized HTML of the Markdown body */
  html: string
}

/**
 * The `prose` block in a page, `shared.rich-text`: the same Markdown as an article's, rendered by the same component.
 *
 * @remarks
 * It exposes no presentation option, so it has no `width`, `align` or `tone` (`BLOCK_EXPOSES`).
 *
 * @public
 */
export interface ProseSection {
  __component: 'shared.rich-text'
  /** The stable id of this block instance, as on any section. */
  blockId?: string
  /** Sanitized HTML of the Markdown body, with an `id` on every heading */
  html: string
}

/**
 * A grid or a masonry of images, `section.gallery`.
 *
 * @public
 */
export interface GallerySection extends SectionBase<'gallery'>, SectionGroupFields, SectionHeadFields, BlockOptions<'section.gallery'> {
  variant: 'grid' | 'masonry'
  title?: string
  images: PageMedia[]
}

/**
 * A 3D model with a poster image, `section.scene`, shown as a background or inline.
 *
 * @public
 */
export interface SceneSection extends SectionBase<'scene'>, SectionGroupFields, SectionHeadFields, BlockOptions<'section.scene'> {
  variant: 'background' | 'inline'
  /** A binary glTF file (`.glb`); with any other file the server drops the section. */
  model: PageMedia
  /** The image the server renders, and the static fallback when the model does not load. */
  poster: PageMedia
  /** Alternative text of the poster and of the model. */
  alt: string
  title?: string
  text?: string
}

/**
 * A reference to a reusable block of the page's site, `section.reusable` (ADR 0022, section 1).
 *
 * @remarks
 * It has no presentation options and no content of its own: the block it points to is what renders, with that block's own options. It is not in `PAGE_SECTION_COMPONENTS`, since it has no `data-section` of its own, and `SectionRenderer` does not render it yet (bogd3v/micelio#896): `knownSections` leaves it out. The page request does not populate the relation yet either, so `reusableBlock` is absent until the renderer asks for it. It may carry a `group` key and is then a member like any other.
 *
 * @public
 */
export interface ReusableSection extends SectionGroupFields {
  __component: 'section.reusable'
  /** The stable id of this block instance, as on any section. */
  blockId?: string
  /** The reusable block it references, by its document id; absent when the relation is empty or not populated. */
  reusableBlock?: { documentId: string }
}

/**
 * Any section of a page, discriminated by `__component`: the ones the renderer draws and the reference to a reusable block.
 *
 * @public
 */
export type PageSection
  = | ReusableSection | HeroSection | FeatureGridSection | MediaShowcaseSection | StatsSection | LogoCloudSection
    | TestimonialsSection | PricingSection | FaqSection | CtaSection | PostListSection
    | NewsletterSection | RichTextSection | ProseSection | GallerySection | SceneSection

/**
 * A page built from sections, as the server returns it after validation.
 *
 * @public
 */
export interface Page {
  /** Strapi's document id (the v5 identifier, not the numeric `id`). */
  documentId: string
  title: string
  slug: string
  /** `en` or `es`. */
  locale?: Locale
  seo?: PageSeo
  /** Sections that failed validation are left out */
  sections: PageSection[]
  /** The page in the other locales, for hreflang */
  translations: PostTranslation[]
}

/** A page as `GET /api/pages/{slug}` sends it: the page, with the symbols of its icons when its sections use some (ADR 0021). */
export interface PageResponse extends Page, IconSymbolCarrier {}
