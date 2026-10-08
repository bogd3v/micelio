// Registry of heavy islands (ADR 0006, section 6). Data only: modules/islands.ts does not build it as an entry,
// and each `entry` is a sibling file `app/islands/<entry>.ts`.

/** What an island needs from the browser; one it lacks leaves the server fallback in place. */
export type HeavyFeature = 'webgl2' | 'wasm' | 'worker'

/** `visible`: near the viewport, after load and idle. `interaction`: a click or key on the island's control. */
export type HeavyTrigger = 'visible' | 'interaction'

/** CSP sources added to the responses of the pages that render the island (ADR 0004). */
export interface HeavyCsp {
  connectSrc?: string[]
  workerSrc?: string[]
}

export interface HeavyIsland {
  /** Block or section the island belongs to (`mermaid`, `playground`, `scene`). */
  id: string
  /** File name, without extension, in `app/islands/`. */
  entry: string
  trigger: HeavyTrigger
  /** What the server markup shows without the island: a poster, the source code, the diagram's source. */
  fallback: string
  features: HeavyFeature[]
  csp?: HeavyCsp
  /** Key under `islands` in `scripts/perf/budgets.json`. */
  budget: string
}

export const HEAVY_FEATURES: readonly HeavyFeature[] = ['webgl2', 'wasm', 'worker']
export const HEAVY_TRIGGERS: readonly HeavyTrigger[] = ['visible', 'interaction']

export const HEAVY_ISLANDS: readonly HeavyIsland[] = []

const NAME = /^[a-z][a-z0-9-]*$/
// An origin (`https://host[:port]`) or a same-origin path; never a wildcard, a keyword, a space or a `;`
const SOURCE = /^(?:https?:\/\/[\w.-]+(?::\d+)?|\/(?!\/)[\w./-]*)$/

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
    if (!NAME.test(island.entry) || island.entry === 'heavy') errors.push(`${label}: entry must name a file of app/islands/`)
    if (!HEAVY_TRIGGERS.includes(island.trigger)) errors.push(`${label}: unknown trigger "${String(island.trigger)}"`)
    if (!island.fallback.trim()) errors.push(`${label}: fallback must describe what the server renders`)
    if (!island.budget.trim()) errors.push(`${label}: budget key is empty`)
    for (const feature of island.features) {
      if (!HEAVY_FEATURES.includes(feature)) errors.push(`${label}: unknown feature "${String(feature)}"`)
    }
    errors.push(...sourceErrors(`${label}: csp.connectSrc`, island.csp?.connectSrc), ...sourceErrors(`${label}: csp.workerSrc`, island.csp?.workerSrc))
  }
  return errors
}
