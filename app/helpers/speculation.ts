import { defaultLocale, Locale } from '../interfaces/locale'

export interface SpeculationRules {
  prerender?: SpeculationRule[]
  prefetch: SpeculationRule[]
}

interface SpeculationRule {
  where: SpeculationCondition
  eagerness: 'moderate' | 'conservative'
}

type SpeculationCondition
  = | { href_matches: string | string[] }
    | { selector_matches: string }
    | { and: SpeculationCondition[] }
    | { not: SpeculationCondition }

/** Routes with side effects or that are not pages, also under each locale prefix (ADR 0006, section 3). */
const EXCLUDED_ROUTES: readonly string[] = ['/api/*', '/account*', '/drafts*', '/newsletter/*', '/confirm*', '/_theme']
/** Files and folders of the build that are not pages: no locale prefix. */
const EXCLUDED_FILES: readonly string[] = ['/pagefind/*', '/_islands/*', '/_media/*', '/*.xml', '/robots.txt']
const EXCLUDED_LINKS = '[download], [rel~=nofollow], [data-no-speculate]'

/**
 * The Speculation Rules of a static or landing site (ADR 0004 and ADR 0006 amendments). They are the same on every page:
 * the static policy shares one set of inline-script hashes. `baseURL` is `app.baseURL`.
 *
 * Without Umami the next page is prerendered on hover or focus (`moderate`) and prefetched on touch (`conservative`, where there is no hover).
 * With Umami a prerender would count a pageview nobody saw, so the rules only prefetch, on hover or focus.
 */
export function speculationRules(options: { baseURL?: string, prerender: boolean }): SpeculationRules {
  const base = (options.baseURL ?? '/').replace(/\/+$/, '')
  const prefixes = ['', ...Object.values(Locale).filter(locale => locale !== defaultLocale).map(locale => `/${locale}`)]
  const excluded = [
    ...prefixes.flatMap(prefix => EXCLUDED_ROUTES.map(route => `${base}${prefix}${route}`)),
    ...EXCLUDED_FILES.map(file => `${base}${file}`),
  ]
  const where: SpeculationCondition = {
    and: [
      { href_matches: `${base}/*` },
      { not: { href_matches: excluded } },
      { not: { selector_matches: EXCLUDED_LINKS } },
    ],
  }
  if (!options.prerender) return { prefetch: [{ where, eagerness: 'moderate' }] }
  return {
    prerender: [{ where, eagerness: 'moderate' }],
    prefetch: [{ where, eagerness: 'conservative' }],
  }
}
