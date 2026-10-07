import type { PageSection } from '~/interfaces'
import { PAGE_SECTION_COMPONENTS } from '~/interfaces/page'

/** Strapi uid shape: lowercase letters, digits and `-_.~`, starting with a letter or digit. */
export const PAGE_SLUG_PATTERN = /^[a-z0-9][a-z0-9_.~-]{0,63}$/

const KNOWN_COMPONENTS: ReadonlySet<string> = new Set(PAGE_SECTION_COMPONENTS.map(kind => `section.${kind}`))

/** The sections the frontend can render, in order. */
export function knownSections(sections: PageSection[] | null | undefined): PageSection[] {
  return (sections ?? []).filter(section => KNOWN_COMPONENTS.has(section.__component))
}

/** A page opened by a hero takes its h1 from the hero; any other page shows its own title. */
export function heroLeadsPage(sections: PageSection[] | null | undefined): boolean {
  return knownSections(sections)[0]?.__component === 'section.hero'
}
