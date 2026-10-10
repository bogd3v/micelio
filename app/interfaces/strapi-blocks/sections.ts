import type { Category } from '../design'
import type { StrapiMediaFile } from './media'

export type StrapiLinkVariant = 'primary' | 'secondary' | 'text'

export type StrapiProjectVisual = 'none' | 'fediverse' | 'palette'

export interface StrapiFact {
  id: number
  label: string
  value: string
  mono?: boolean | null
}

export interface StrapiLink {
  id: number
  label: string
  url: string
  variant: StrapiLinkVariant
}

export interface StrapiItem {
  id: number
  title?: string | null
  text: string
  html?: string
}

export interface StrapiTopic {
  id: number
  category: Category
  title: string
  description?: string | null
}

export interface StrapiTechItem {
  id: number
  name: string
}

export interface StrapiProject {
  id: number
  eyebrow?: string | null
  meta?: string | null
  title: string
  description?: string | null
  facts?: StrapiFact[]
  stack?: StrapiTechItem[]
  links?: StrapiLink[]
  featured?: boolean | null
  visual: StrapiProjectVisual
  visualCaption?: string | null
}

export interface StrapiContactLink {
  id: number
  network: string
  handle: string
  url: string
}

export interface StrapiProfile {
  id: number
  __component: 'about.profile'
  eyebrow?: string | null
  title: string
  lead?: string | null
  facts?: StrapiFact[]
  links?: StrapiLink[]
  photo?: StrapiMediaFile | null
  plateLabel?: string | null
  plateCoordinates?: string | null
  caption?: string | null
}

export interface StrapiStatement {
  id: number
  __component: 'about.statement'
  eyebrow?: string | null
  statement: string
  body?: string | null
}

export interface StrapiTopics {
  id: number
  __component: 'about.topics'
  eyebrow?: string | null
  title?: string | null
  intro?: string | null
  topics?: StrapiTopic[]
  footnoteLabel?: string | null
  footnote?: string | null
}

export interface StrapiProjects {
  id: number
  __component: 'about.projects'
  anchor?: string | null
  eyebrow?: string | null
  title?: string | null
  intro?: string | null
  projects?: StrapiProject[]
}

export interface StrapiPrinciples {
  id: number
  __component: 'about.principles'
  eyebrow?: string | null
  title?: string | null
  principles?: StrapiItem[]
}

export interface StrapiOpenSource {
  id: number
  __component: 'about.open-source'
  eyebrow?: string | null
  text?: string | null
  code?: string | null
  guideTitle?: string | null
  guide?: StrapiItem[]
}

export interface StrapiContact {
  id: number
  __component: 'about.contact'
  eyebrow?: string | null
  title?: string | null
  fediverseLabel?: string | null
  fediverseHandle?: string | null
  fediverseLink?: StrapiLink | null
  extraLink?: StrapiLink | null
  socials?: StrapiContactLink[]
}
