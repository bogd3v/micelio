// Validation of the heavy island registry (ADR 0006, section 6); the registry is `HEAVY_ISLANDS` in `lib/constants.ts`, its types in `types.ts`.
// modules/islands.ts does not build these three files as entries, and each `entry` is a sibling file `app/islands/<entry>.ts`.
import type { HeavyFeature, HeavyIsland, HeavySaveData, HeavyTrigger } from './types'

export const HEAVY_FEATURES: readonly HeavyFeature[] = ['webgl2', 'wasm', 'worker']
export const HEAVY_TRIGGERS: readonly HeavyTrigger[] = ['visible', 'interaction']
export const HEAVY_SAVE_DATA: readonly HeavySaveData[] = ['load', 'skip']

// Files of app/islands/ that are not islands
const RESERVED_ENTRIES = new Set(['heavy', 'types', 'constants'])
// A control is an attribute selector of ours, never free CSS
export const CONTROL = /^\[data-[a-z][a-z-]*\]$/
const NAME = /^[a-z][a-z0-9-]*$/
// `'self'` or an absolute origin with an optional path; never a wildcard, another keyword, a bare path, a space or a `;`
const SOURCE = /^(?:'self'|https:\/\/[\w.-]+(?::\d+)?(?:\/[\w./-]*)?|http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/[\w./-]*)?)$/

function sourceErrors(label: string, sources: unknown): string[] {
  if (sources === undefined) return []
  if (!Array.isArray(sources)) return [`${label} must be an array`]
  return sources.filter(source => typeof source !== 'string' || !SOURCE.test(source)).map(source => `${label} has an invalid source: ${String(source)}`)
}

/** Problems of a registry, one message each; empty when it is valid. */
export function validateHeavyIslands(islands: readonly HeavyIsland[]): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const island of islands) {
    const label = `island "${island.id}"`
    if (!NAME.test(island.id)) errors.push(`${label}: id must be lowercase letters, digits and hyphens`)
    if (ids.has(island.id)) errors.push(`${label}: duplicate id`)
    ids.add(island.id)
    if (!NAME.test(island.entry) || RESERVED_ENTRIES.has(island.entry)) errors.push(`${label}: entry must name a file of app/islands/`)
    if (!HEAVY_TRIGGERS.includes(island.trigger)) errors.push(`${label}: unknown trigger "${String(island.trigger)}"`)
    if (!island.fallback.trim()) errors.push(`${label}: fallback must describe what the server renders`)
    if (island.saveData !== undefined && !HEAVY_SAVE_DATA.includes(island.saveData)) errors.push(`${label}: unknown saveData "${String(island.saveData)}"`)
    if (island.trigger === 'interaction' && !(island.control && CONTROL.test(island.control))) errors.push(`${label}: an interaction island needs a control like [data-name]`)
    if (island.trigger === 'visible' && island.control !== undefined) errors.push(`${label}: only an interaction island has a control`)
    if (island.motion !== undefined && island.motion !== true) errors.push(`${label}: motion must be true or absent`)
    if (!island.budget.trim()) errors.push(`${label}: budget key is empty`)
    for (const feature of island.features) {
      if (!HEAVY_FEATURES.includes(feature)) errors.push(`${label}: unknown feature "${String(feature)}"`)
    }
    if (island.csp?.wasm !== undefined && island.csp.wasm !== true) errors.push(`${label}: csp.wasm must be true or absent`)
    errors.push(...sourceErrors(`${label}: csp.connectSrc`, island.csp?.connectSrc), ...sourceErrors(`${label}: csp.workerSrc`, island.csp?.workerSrc))
  }
  return errors
}
