import type { PostListItem, PostTranslation } from './strapi-post'

/**
 * The section components a page can render, by their name without the `section.` prefix.
 *
 * @remarks
 * Sections of any other component are left out by the server.
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
}

/**
 * The opening section of a page, `section.hero`: a title, an optional text, up to two links and a media.
 *
 * @public
 */
export interface HeroSection extends SectionBase<'hero'> {
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
  icon?: PageMedia
  title: string
  text?: string
}

/**
 * A grid, a list or a bento layout of features, `section.feature-grid`.
 *
 * @public
 */
export interface FeatureGridSection extends SectionBase<'feature-grid'> {
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
export interface MediaShowcaseSection extends SectionBase<'media-showcase'> {
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
  /** Shown as written; a string, so `12k` or `99%` need no conversion. */
  value: string
  label: string
}

/**
 * A row or a set of cards of figures, `section.stats`.
 *
 * @public
 */
export interface StatsSection extends SectionBase<'stats'> {
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
export interface LogoCloudSection extends SectionBase<'logo-cloud'> {
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
  /** Plain text, not Markdown. */
  quote: string
  author: string
  role?: string
  avatar?: PageMedia
}

/**
 * One quote or a grid of quotes, `section.testimonials`.
 *
 * @public
 */
export interface TestimonialsSection extends SectionBase<'testimonials'> {
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
export interface PricingSection extends SectionBase<'pricing'> {
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
  question: string
  /** Sanitized HTML of the Markdown answer */
  html: string
}

/**
 * A list of questions and answers, `section.faq`.
 *
 * @public
 */
export interface FaqSection extends SectionBase<'faq'> {
  variant: 'list' | 'two-columns'
  title?: string
  items: FaqItem[]
}

/**
 * A call to action with up to two links, `section.cta`.
 *
 * @public
 */
export interface CtaSection extends SectionBase<'cta'> {
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
export interface PostListSection extends SectionBase<'post-list'> {
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
export interface NewsletterSection extends SectionBase<'newsletter'> {
  variant: 'inline' | 'card'
  title?: string
  text?: string
  buttonLabel?: string
}

/**
 * A text block written in Markdown, `section.rich-text`.
 *
 * @public
 */
export interface RichTextSection extends SectionBase<'rich-text'> {
  /** Sanitized HTML of the Markdown body */
  html: string
}

/**
 * A grid or a masonry of images, `section.gallery`.
 *
 * @public
 */
export interface GallerySection extends SectionBase<'gallery'> {
  variant: 'grid' | 'masonry'
  title?: string
  images: PageMedia[]
}

/**
 * A 3D model with a poster image, `section.scene`, shown as a background or inline.
 *
 * @public
 */
export interface SceneSection extends SectionBase<'scene'> {
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
 * Any section of a page, discriminated by `__component`.
 *
 * @public
 */
export type PageSection
  = | HeroSection | FeatureGridSection | MediaShowcaseSection | StatsSection | LogoCloudSection
    | TestimonialsSection | PricingSection | FaqSection | CtaSection | PostListSection
    | NewsletterSection | RichTextSection | GallerySection | SceneSection

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
  locale?: string
  seo?: PageSeo
  /** Sections that failed validation are left out */
  sections: PageSection[]
  /** The page in the other locales, for hreflang */
  translations: PostTranslation[]
}
