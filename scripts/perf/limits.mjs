// The page limits of measure.mjs and what `--check` fails on (docs/performance.md, "Budgets"). Pure: no browser, no network.

import { swdMilligramsPerView } from './carbon.mjs'

/** Metrics where a value under the limit is the problem (Lighthouse scores) */
export const HIGHER_IS_BETTER = new Set(['performance', 'accessibility'])

const round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits

/**
 * The limits of one page and level: the mode's, with the metrics of a theme's recorded exception replacing them.
 *
 * @remarks
 * At the `error` level two allowances grow them. A run with a display font adds `extraFontKb` to `fontKb`, and a theme served by an
 * image built for another theme adds `variantKb` (`variantAllowance` of `variants.mjs`) to `jsKb`. `co2Mg` grows by the carbon
 * estimate of the bytes those two allowances add, so a page those limits accept is not refused on carbon for the same bytes.
 *
 * `modeLimits` is `modes.<mode>.limits` of `budgets.json`; `exceptionLimits` is `themes.<id>.limits` of the theme under test, when it
 * has an exception for the mode; `extraFontKb` and `variantKb` are KB (KiB), 0 when there is no display font or no variant of its own.
 *
 * @param {{ modeLimits: Record<string, any>, exceptionLimits?: Record<string, any>, page: string, level: 'error' | 'warn', extraFontKb?: number, variantKb?: number }} options
 * @returns {Record<string, number>}
 */
export function pageLimits({ modeLimits, exceptionLimits, page, level, extraFontKb = 0, variantKb = 0 }) {
  const limits = { ...(modeLimits?.[page]?.[level] ?? {}), ...(exceptionLimits?.[page]?.[level] ?? {}) }
  if (level !== 'error') return limits
  if (extraFontKb && limits.fontKb !== undefined) limits.fontKb = round(limits.fontKb + extraFontKb, 1)
  if (variantKb && limits.jsKb !== undefined) limits.jsKb = round(limits.jsKb + variantKb, 1)
  if (limits.co2Mg !== undefined && extraFontKb + variantKb) limits.co2Mg = round(limits.co2Mg + swdMilligramsPerView((extraFontKb + variantKb) * 1024), 2)
  return limits
}

/** One problem per metric of `limits` that the page's `metrics` go over (under, for a score); `--check` fails on an `error` one. */
export function budgetProblems(page, metrics, limits, level) {
  return Object.entries(limits ?? {}).flatMap(([metric, limit]) => {
    const value = metrics[metric]
    const over = HIGHER_IS_BETTER.has(metric) ? value < limit : value > limit
    return over ? [{ level, page, metric, value, limit }] : []
  })
}
