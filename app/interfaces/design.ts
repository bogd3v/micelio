export enum Category {
  Privacy = 'privacidad',
  Diy = 'diy',
  Ai = 'ia',
  Software = 'software',
  Linux = 'linux',
}

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'text'

export type ButtonSize = 'md' | 'sm'

export type CalloutTone = 'note' | 'warning' | 'danger'

export interface CodeLine {
  prompt: boolean
  text: string
}

export interface CategoryInfo {
  pillar: 1 | 2 | null
}

export interface CategoryCount {
  id: number
  slug: string | null
  name: string
  count: number
}

export interface CategoryLike {
  name?: string | null
  slug?: string | null
}

export type NewsletterStatus = 'idle' | 'success' | 'error'

export interface NewsletterResult {
  status: NewsletterStatus
  message: string
  invalid: boolean
}

export interface PostCardProps {
  title: string
  href: string
  excerpt?: string
  snippet?: string
  category?: Category
  date?: string
  dateTime?: string
  author?: string
  readTime?: string
  image?: string
  imageAlt?: string
  read?: boolean
}

export type HeaderSection = 'home' | 'blog' | 'about'

/** `id` is a header section, or a landing's anchor or link. */
export interface NavLink {
  id: HeaderSection | string
  label: string
  to: string
  /** A landing's link to a section of the home page: a plain `<a>` (the router would mark every one of them current) */
  anchor?: boolean
  /** A landing's link from its hero or call to action */
  action?: boolean
}

export type PaletteKind = 'article' | 'topic' | 'action'

export type PaletteAction = 'theme' | 'fediverse'

export interface TextSegment {
  text: string
  match: boolean
}

export interface PaletteOption {
  id: string
  kind: PaletteKind
  label: string
  snippet?: string
  hint?: string
  color?: string
  to?: string
  action?: PaletteAction
}

export interface PaletteGroup {
  kind: PaletteKind
  options: PaletteOption[]
}

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

export interface ContourRing {
  d: string
  major: boolean
}

export interface ContourSet {
  name: string
  width: number
  height: number
  options: ContourOptions
}

export interface FieldGuideTopic {
  category: Category
  count: number
}

export type InstanceError = 'empty' | 'invalid'

export interface InstanceResult {
  domain?: string
  error?: InstanceError
}
