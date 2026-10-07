import type { PageSection } from '~/interfaces'
import { PAGE_SECTION_COMPONENTS } from '~/interfaces/page'

/** Strapi uid shape: lowercase letters, digits and `-_.~`, starting with a letter or digit. */
export const PAGE_SLUG_PATTERN = /^[a-z0-9][a-z0-9_.~-]{0,63}$/

const KNOWN_COMPONENTS: ReadonlySet<string> = new Set(PAGE_SECTION_COMPONENTS.map(kind => `section.${kind}`))

const WARN_EVERY_MS = 10 * 60 * 1000
const WARN_MAX_KEYS = 100
const warned = new Map<string, number>()

/** console.warn at most once per key every ten minutes (server render paths run on every request); keeps at most 100 keys. */
export function warnOnce(key: string, message: string): void {
  const now = Date.now()
  const last = warned.get(key)
  if (last !== undefined && now - last < WARN_EVERY_MS) return
  if (warned.size >= WARN_MAX_KEYS) warned.clear()
  warned.set(key, now)
  console.warn(message)
}

/** The sections the frontend can render, in order. */
export function knownSections(sections: PageSection[] | null | undefined): PageSection[] {
  return (sections ?? []).filter(section => KNOWN_COMPONENTS.has(section.__component))
}

/** A page opened by a hero takes its h1 from the hero; any other page shows its own title. */
export function heroLeadsPage(sections: PageSection[] | null | undefined): boolean {
  return knownSections(sections)[0]?.__component === 'section.hero'
}
