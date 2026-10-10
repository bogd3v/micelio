import type { Category } from '../design'
import type { StrapiMediaFile } from './media'

/**
 * The style of a link button: `primary`, `secondary` or `text`.
 *
 * @public
 */
export type StrapiLinkVariant = 'primary' | 'secondary' | 'text'

/**
 * The visual of a project card: none, a fediverse visual or a colour palette.
 *
 * @public
 */
export type StrapiProjectVisual = 'none' | 'fediverse' | 'palette'

/**
 * A label and value pair of a profile or a project, shown as a definition list item, `about.fact`.
 *
 * @public
 */
export interface StrapiFact {
  id: number
  label: string
  value: string
  /** Shows the value in a monospace font. */
  mono?: boolean | null
}

/**
 * A link button of an about block, `about.link`.
 *
 * @public
 */
export interface StrapiLink {
  id: number
  label: string
  /** An absolute URL or a path; resolved by `resolveLink`. */
  url: string
  variant: StrapiLinkVariant
}

/**
 * A principle, or a step of the open source guide, `about.item`.
 *
 * @remarks
 * `text` is plain text in a principle and inline Markdown in a guide step, which the server renders into `html`.
 *
 * @public
 */
export interface StrapiItem {
  id: number
  /** The heading of a principle, shown above its text. */
  title?: string | null
  text: string
  /** The rendered `text` of a guide step; set on the server. */
  html?: string
}

/**
 * A topic of the topics section, with the category it belongs to, `about.topic`.
 *
 * @public
 */
export interface StrapiTopic {
  id: number
  /** The category: it sets the colour of the topic and whether it is a pillar. */
  category: Category
  title: string
  description?: string | null
}

/**
 * A technology in the stack of a project, `shared.tech-item`.
 *
 * @public
 */
export interface StrapiTechItem {
  id: number
  name: string
}

/**
 * A project card of the projects section, `about.project`.
 *
 * @public
 */
export interface StrapiProject {
  id: number
  eyebrow?: string | null
  meta?: string | null
  title: string
  description?: string | null
  facts?: StrapiFact[]
  stack?: StrapiTechItem[]
  links?: StrapiLink[]
  /** A featured project gets the large layout and is shown first. */
  featured?: boolean | null
  visual: StrapiProjectVisual
  /** The caption of the fediverse visual; shown only for that visual. */
  visualCaption?: string | null
}

/**
 * A social profile of the contact section, `about.contact-link`.
 *
 * @public
 */
export interface StrapiContactLink {
  id: number
  network: string
  /** The account name, shown with the link. */
  handle: string
  url: string
}

/**
 * The profile block of the about page: a title, a lead, facts and a photo on a plate, `about.profile`.
 *
 * @public
 */
export interface StrapiProfile {
  id: number
  __component: 'about.profile'
  eyebrow?: string | null
  title: string
  lead?: string | null
  facts?: StrapiFact[]
  links?: StrapiLink[]
  /** The portrait; its alternative text falls back to the title. */
  photo?: StrapiMediaFile | null
  /** Small label on the photo plate. */
  plateLabel?: string | null
  /** Small coordinates text on the photo plate. */
  plateCoordinates?: string | null
  /** The caption under the photo plate. */
  caption?: string | null
}

/**
 * A statement with an optional body text, `about.statement`.
 *
 * @public
 */
export interface StrapiStatement {
  id: number
  __component: 'about.statement'
  eyebrow?: string | null
  statement: string
  body?: string | null
}

/**
 * The topics section of the about page: one card per topic, with an optional footnote, `about.topics`.
 *
 * @public
 */
export interface StrapiTopics {
  id: number
  __component: 'about.topics'
  eyebrow?: string | null
  title?: string | null
  intro?: string | null
  topics?: StrapiTopic[]
  /** The label before the footnote. */
  footnoteLabel?: string | null
  footnote?: string | null
}

/**
 * The projects section of the about page, `about.projects`.
 *
 * @public
 */
export interface StrapiProjects {
  id: number
  __component: 'about.projects'
  /** The element id of the section, for links to `#anchor`; empty when none. */
  anchor?: string | null
  eyebrow?: string | null
  title?: string | null
  intro?: string | null
  projects?: StrapiProject[]
}

/**
 * The principles section of the about page: a numbered list of principles, `about.principles`.
 *
 * @public
 */
export interface StrapiPrinciples {
  id: number
  __component: 'about.principles'
  eyebrow?: string | null
  title?: string | null
  principles?: StrapiItem[]
}

/**
 * The open source section of the about page: a text, a shell command and a guide, `about.open-source`.
 *
 * @public
 */
export interface StrapiOpenSource {
  id: number
  __component: 'about.open-source'
  eyebrow?: string | null
  text?: string | null
  /** A shell command, shown in a code block. */
  code?: string | null
  /** The heading of the guide. */
  guideTitle?: string | null
  guide?: StrapiItem[]
}

/**
 * The contact section of the about page: a fediverse handle and links, `about.contact`.
 *
 * @public
 */
export interface StrapiContact {
  id: number
  __component: 'about.contact'
  eyebrow?: string | null
  title?: string | null
  fediverseLabel?: string | null
  /** The fediverse handle, shown as text. */
  fediverseHandle?: string | null
  /** The link that follows the fediverse handle; resolved by `resolveLink`. */
  fediverseLink?: StrapiLink | null
  /** A second link, marked when it leads outside the site. */
  extraLink?: StrapiLink | null
  socials?: StrapiContactLink[]
}
