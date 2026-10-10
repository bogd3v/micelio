// Island budgets of measure.mjs (ADR 0006, section 6; docs/performance.md, "Islands"). Pure: no browser, no network.

export const ISLANDS_PREFIX = '/_islands/'
// Islands with a budget of their own shape that are not in the heavy registry (measure.mjs measures them itself)
export const LIGHT_ISLANDS = ['search']
// What a heavy island's `error` limits can name
export const HEAVY_METRICS = ['scriptGzKb', 'wasmKb', 'totalKb', 'requests']

/**
 * Whether a request a page makes while it loads, before anyone uses it, is stray.
 * Before the load event nothing of an island loads; after it only a `visible` island may (it waits for load and idle).
 * Pagefind never loads before the search is used, and a static page declares every other script it runs.
 */
export function isStrayRequest({ pathname, beforeLoad, isStatic, declaredScripts }) {
  if (declaredScripts.includes(pathname)) return false
  if (pathname.startsWith('/pagefind/')) return true
  if (pathname.startsWith(ISLANDS_PREFIX)) return beforeLoad
  return isStatic && /\.m?js$/.test(pathname)
}

/** The custom element a heavy island upgrades */
export function islandElement(island) {
  return `micelio-${island.id}`
}

/** The island's own budget key and its variants (`playground:python`): one measurement each, on its own fixture */
export function budgetKeysOf(island, islands = {}) {
  return Object.keys(islands).filter(key => key === island.budget || key.startsWith(`${island.budget}:`))
}

const VARIANT = /^[a-z][a-z0-9-]*$/

/** Problems of the `islands` sections of budgets.json against the heavy registry, one message each */
export function islandBudgetErrors(registry, modes) {
  const errors = []
  const byKey = new Map(registry.map(island => [island.budget, island]))
  for (const island of registry) {
    if (!Object.values(modes).some(mode => budgetKeysOf(island, mode.islands).length)) errors.push(`island "${island.id}" has no budget: add modes.<mode>.islands.${island.budget} to budgets.json`)
  }
  for (const [modeId, mode] of Object.entries(modes)) {
    for (const [key, budget] of Object.entries(mode.islands ?? {})) {
      const label = `modes.${modeId}.islands.${key}`
      if (LIGHT_ISLANDS.includes(key)) continue
      const [base, variant, ...rest] = key.split(':')
      const island = byKey.get(base)
      if (!island) {
        errors.push(`${label} is not the budget of an island in app/islands/lib/constants.ts`)
        continue
      }
      if (variant !== undefined && (!VARIANT.test(variant) || rest.length)) {
        errors.push(`${label}: a variant is <budget>:<name>, the name in lowercase letters, digits and hyphens`)
        continue
      }
      if (typeof budget.page !== 'string' || !budget.page.startsWith('/')) errors.push(`${label}.page must be the path of a page that renders <${islandElement(island)}>`)
      if (budget.control !== undefined && (island.trigger !== 'interaction' || typeof budget.control !== 'string')) errors.push(`${label}.control is a CSS selector, and only for an island triggered by interaction`)
      if (typeof budget.ready !== 'string' || !budget.ready.trim()) errors.push(`${label}.ready must be the CSS selector of the island's rendered result`)
      const limits = Object.entries(budget.error ?? {})
      if (!limits.length) errors.push(`${label}.error needs at least one limit (${HEAVY_METRICS.join(', ')})`)
      for (const [metric, limit] of limits) {
        if (!HEAVY_METRICS.includes(metric)) errors.push(`${label}.error.${metric} is not a heavy island metric (${HEAVY_METRICS.join(', ')})`)
        else if (typeof limit !== 'number') errors.push(`${label}.error.${metric} must be a number`)
      }
    }
  }
  return errors
}

const kb = value => Math.round(value / 10.24) / 100

/** What an island loaded once used, from its distinct files as sent ({ path, sent, gzip }) */
export function islandMetrics(files) {
  const sum = (list, key) => list.reduce((total, file) => total + file[key], 0)
  return {
    scriptGzKb: kb(sum(files.filter(file => /\.m?js$/.test(file.path)), 'gzip')),
    wasmKb: kb(sum(files.filter(file => file.path.endsWith('.wasm')), 'sent')),
    totalKb: kb(sum(files, 'sent')),
    requests: files.length,
  }
}

/** An island's metrics over its `error` limits; a metric that was not measured is a problem too */
export function islandProblems(name, metrics, limits) {
  return Object.entries(limits ?? {}).flatMap(([metric, limit]) => {
    const value = metrics[metric]
    return value === undefined || value > limit ? [{ level: 'error', page: `island ${name}`, metric, value, limit }] : []
  })
}
