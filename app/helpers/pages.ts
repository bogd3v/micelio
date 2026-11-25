import type { PageSection } from '~/interfaces'
import { PAGE_SECTION_COMPONENTS } from '~/interfaces/page'

const KNOWN_COMPONENTS: ReadonlySet<string> = new Set<string>([...PAGE_SECTION_COMPONENTS.map(kind => `section.${kind}`), 'shared.rich-text', 'section.reusable'])

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

/**
 * The sections the frontend can render, in order: a page draft's Playground blocks are left out.
 *
 * @remarks
 * A reference to a reusable block stays, resolved or not, so the positions are the page's own: `data-myc-index` counts them (ADR 0019).
 */
export function knownSections(sections: ReadonlyArray<{ __component: string }> | null | undefined): PageSection[] {
  return (sections ?? []).filter(section => KNOWN_COMPONENTS.has(section.__component)) as PageSection[]
}

/** A page opened by a hero, drawn as itself or through a reference, takes its h1 from the hero; any other page shows its own title. */
export function heroLeadsPage(sections: PageSection[] | null | undefined): boolean {
  const first = knownSections(sections)[0]
  return (first?.__component === 'section.reusable' ? first.block : first)?.__component === 'section.hero'
}
