import type { PostListItem, PostTranslation } from './strapi-post'

export const PAGE_SECTION_COMPONENTS = [
  'hero', 'feature-grid', 'media-showcase', 'stats', 'logo-cloud', 'testimonials', 'pricing',
  'faq', 'cta', 'post-list', 'newsletter', 'rich-text', 'gallery', 'scene',
] as const

export type PageSectionKind = typeof PAGE_SECTION_COMPONENTS[number]

export interface PageMedia {
  url: string
  alternativeText?: string
  width?: number
  height?: number
  mime?: string
}

/** `url` is http(s), mailto: or a path on the site. */
export interface PageLink {
  label: string
  url: string
}

export interface PageSeo {
  metaTitle: string
  metaDescription: string
  metaImage?: PageMedia
  metaRobots?: string
  keywords?: string
  canonicalURL?: string
}

interface SectionBase<K extends PageSectionKind> {
  __component: `section.${K}`
}

export interface HeroSection extends SectionBase<'hero'> {
  variant: 'centered' | 'split' | 'full-bleed'
  title: string
  text?: string
  primaryLink?: PageLink
  secondaryLink?: PageLink
  media?: PageMedia
}

export interface FeatureItem {
  icon?: PageMedia
  title: string
  text?: string
}

export interface FeatureGridSection extends SectionBase<'feature-grid'> {
  variant: 'grid' | 'list' | 'bento'
  title?: string
  text?: string
  items: FeatureItem[]
}

export interface MediaShowcaseSection extends SectionBase<'media-showcase'> {
  variant: 'left' | 'right' | 'stacked'
  title?: string
  /** Sanitized HTML of the Markdown text */
  html?: string
  media: PageMedia
  link?: PageLink
}

export interface StatItem {
  value: string
  label: string
}

export interface StatsSection extends SectionBase<'stats'> {
  variant: 'row' | 'cards'
  title?: string
  items: StatItem[]
}

export interface LogoItem {
  image: PageMedia
  name: string
  /** http(s) only */
  url?: string
}

export interface LogoCloudSection extends SectionBase<'logo-cloud'> {
  variant: 'row' | 'marquee'
  title?: string
  logos: LogoItem[]
}

export interface TestimonialItem {
  quote: string
  author: string
  role?: string
  avatar?: PageMedia
}

export interface TestimonialsSection extends SectionBase<'testimonials'> {
  variant: 'single' | 'grid'
  title?: string
  items: TestimonialItem[]
}

export interface PricingPlan {
  name: string
  price: string
  period?: string
  /** One feature per line in the CMS */
  features: string[]
  link?: PageLink
  recommended: boolean
}

export interface PricingSection extends SectionBase<'pricing'> {
  variant: 'cards' | 'table'
  title?: string
  text?: string
  plans: PricingPlan[]
}

export interface FaqItem {
  question: string
  /** Sanitized HTML of the Markdown answer */
  html: string
}

export interface FaqSection extends SectionBase<'faq'> {
  variant: 'list' | 'two-columns'
  title?: string
  items: FaqItem[]
}

export interface CtaSection extends SectionBase<'cta'> {
  variant: 'banner' | 'card'
  title: string
  text?: string
  primaryLink?: PageLink
  secondaryLink?: PageLink
}

export interface PostListSection extends SectionBase<'post-list'> {
  variant: 'cards' | 'list'
  title?: string
  /** Category or tag slug the list is filtered by; never both */
  category?: string
  tag?: string
  count: number
  /** Resolved on the server, newest first; empty when there are none */
  posts: PostListItem[]
}

export interface NewsletterSection extends SectionBase<'newsletter'> {
  variant: 'inline' | 'card'
  title?: string
  text?: string
  buttonLabel?: string
}

export interface RichTextSection extends SectionBase<'rich-text'> {
  /** Sanitized HTML of the Markdown body */
  html: string
}

export interface GallerySection extends SectionBase<'gallery'> {
  variant: 'grid' | 'masonry'
  title?: string
  images: PageMedia[]
}

export interface SceneSection extends SectionBase<'scene'> {
  variant: 'background' | 'inline'
  /** A .glb or .gltf file */
  model: PageMedia
  poster: PageMedia
  alt: string
  title?: string
  text?: string
}

export type PageSection
  = | HeroSection | FeatureGridSection | MediaShowcaseSection | StatsSection | LogoCloudSection
    | TestimonialsSection | PricingSection | FaqSection | CtaSection | PostListSection
    | NewsletterSection | RichTextSection | GallerySection | SceneSection

export interface Page {
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
