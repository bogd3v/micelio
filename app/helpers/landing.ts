import type { LandingNavLink } from '../interfaces/design'
import type { PageLink, PageSection } from '../interfaces/page'
import { localePrefixSource } from './localePrefix'
import { resolveSectionLink } from './links'
import { slugify } from './slugify'

interface LandingContext {
  /** The newsletter section renders only when the module is on */
  newsletterOn: boolean
  /** Site paths of the blog are not linked when the build has no blog */
  blogEnabled: boolean
}

interface SectionAnchor {
  /** Position in the list the renderer shows */
  index: number
  id: string
  label: string
}

const ID_PREFIX = 'section-'
const BLOG_PATH = new RegExp(`^${localePrefixSource()}/blog(?:[/?#]|$)`)

/** The title of a section that renders and is worth a navigation entry (the hero opens the page: the brand link goes there). */
function anchorTitle(section: PageSection, context: LandingContext): string | undefined {
  if (section.__component === 'section.hero' || section.__component === 'section.rich-text') return undefined
  if (section.__component === 'section.post-list' && !section.posts?.length) return undefined
  if (section.__component === 'section.newsletter' && !context.newsletterOn) return undefined
  return section.title?.trim() || undefined
}

/**
 * Stable `id`s for the sections of the home page that have a title, derived from the title and unique on the page
 * (`section-pricing`, `section-pricing-2`). The renderer and the navigation call this with the same sections, so they agree.
 */
export function sectionAnchors(sections: readonly PageSection[], context: LandingContext): SectionAnchor[] {
  const taken = new Set<string>()
  const anchors: SectionAnchor[] = []
  sections.forEach((section, index) => {
    const label = anchorTitle(section, context)
    if (!label) return
    const base = `${ID_PREFIX}${slugify(label) || index + 1}`
    let id = base
    for (let suffix = 2; taken.has(id); suffix++) id = `${base}-${suffix}`
    taken.add(id)
    anchors.push({ index, id, label })
  })
  return anchors
}

function actionLinks(sections: readonly PageSection[]): PageLink[] {
  return sections.flatMap((section) => {
    if (section.__component === 'section.hero') return [section.primaryLink, section.secondaryLink]
    if (section.__component === 'section.cta') return [section.primaryLink]
    return []
  }).filter((link): link is PageLink => Boolean(link))
}

/**
 * The navigation of a landing: anchors to the titled sections of the home page (`homePath` + `#id`), then the links of its hero
 * and call to action sections, once each. A link the section renderer would reject, or one to a blog the build does not have, is left out.
 */
export function landingLinks(
  sections: readonly PageSection[],
  homePath: string,
  context: LandingContext,
  resolve: { prefix: string, localize: (path: string) => string },
): LandingNavLink[] {
  const links: LandingNavLink[] = sectionAnchors(sections, context).map(anchor => ({ id: anchor.id, label: anchor.label, to: `${homePath}#${anchor.id}`, anchor: true }))
  const seen = new Set<string>()
  actionLinks(sections).forEach((link, index) => {
    const target = resolveSectionLink(link.url, resolve.prefix, resolve.localize)
    if (!target || seen.has(target.href)) return
    if (!context.blogEnabled && BLOG_PATH.test(target.href)) return
    seen.add(target.href)
    links.push({ id: `link-${index + 1}`, label: link.label, to: target.href, action: true })
  })
  return links
}

/** The header has room for a few entries: the first anchors and the first links of the hero and call to action. Everything else is in the footer navigation. */
const HEADER_ANCHORS = 4
const HEADER_ACTIONS = 2

export function headerLinks<T extends { anchor?: boolean, action?: boolean }>(links: readonly T[]): T[] {
  if (!links.some(link => link.anchor || link.action)) return [...links]
  const anchors = links.filter(link => link.anchor).slice(0, HEADER_ANCHORS)
  const actions = links.filter(link => link.action).slice(0, HEADER_ACTIONS)
  return links.filter(link => anchors.includes(link) || actions.includes(link) || !(link.anchor || link.action))
}
