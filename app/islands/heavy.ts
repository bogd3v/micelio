// Registry of heavy islands (ADR 0006, section 6). Data only: modules/islands.ts does not build it as an entry,
// and each `entry` is a sibling file `app/islands/<entry>.ts`.

/** What an island needs from the browser; one it lacks leaves the server fallback in place. */
export type HeavyFeature = 'webgl2' | 'wasm' | 'worker'

/** `visible`: near the viewport, after load and idle. `interaction`: a click or key on the island's control. */
export type HeavyTrigger = 'visible' | 'interaction'

/** What `Save-Data` does to a `visible` island: `skip` keeps the fallback (the default), `load` loads it anyway. An `interaction` island always loads. */
export type HeavySaveData = 'load' | 'skip'

/**
 * CSP additions for the responses of the pages that render the island (ADR 0004, ADR 0006).
 * Sources are `'self'` or absolute `https://` origins with an optional path (`http://` only for localhost).
 */
export interface HeavyCsp {
  connectSrc?: string[]
  workerSrc?: string[]
  /** Adds `'wasm-unsafe-eval'` to `script-src`. */
  wasm?: true
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
  saveData?: HeavySaveData
  /** `interaction` only, required: attribute selector (`[data-playground-run]`), inside the element, of the control whose press loads the island. */
  control?: string
  csp?: HeavyCsp
  /** Key under `islands` in `scripts/perf/budgets.json`. */
  budget: string
}

export const HEAVY_FEATURES: readonly HeavyFeature[] = ['webgl2', 'wasm', 'worker']
export const HEAVY_TRIGGERS: readonly HeavyTrigger[] = ['visible', 'interaction']
export const HEAVY_SAVE_DATA: readonly HeavySaveData[] = ['load', 'skip']

export const HEAVY_ISLANDS: readonly HeavyIsland[] = [
  {
    id: 'mermaid',
    entry: 'mermaid',
    trigger: 'visible',
    fallback: 'The diagram\'s source in the code block that RichTextBlock renders',
    features: [],
    // A diagram is the article's content, not decoration (ADR 0006, amendment of #247 PR 3)
    saveData: 'load',
    budget: 'mermaid',
  },
  {
    id: 'playground',
    entry: 'playground',
    trigger: 'interaction',
    fallback: 'the highlighted code and its expected output',
    features: ['wasm', 'worker'],
    control: '[data-playground-run]',
    // The page may start a Worker of its own origin. Only the Worker compiles WebAssembly, under its own policy, workerPolicy() (ADR 0004)
    csp: { workerSrc: ['\'self\''] },
    budget: 'playground',
  },
]

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
    if (!NAME.test(island.entry) || island.entry === 'heavy') errors.push(`${label}: entry must name a file of app/islands/`)
    if (!HEAVY_TRIGGERS.includes(island.trigger)) errors.push(`${label}: unknown trigger "${String(island.trigger)}"`)
    if (!island.fallback.trim()) errors.push(`${label}: fallback must describe what the server renders`)
    if (island.saveData !== undefined && !HEAVY_SAVE_DATA.includes(island.saveData)) errors.push(`${label}: unknown saveData "${String(island.saveData)}"`)
    if (island.trigger === 'interaction' && !(island.control && CONTROL.test(island.control))) errors.push(`${label}: an interaction island needs a control like [data-name]`)
    if (island.trigger === 'visible' && island.control !== undefined) errors.push(`${label}: only an interaction island has a control`)
    if (!island.budget.trim()) errors.push(`${label}: budget key is empty`)
    for (const feature of island.features) {
      if (!HEAVY_FEATURES.includes(feature)) errors.push(`${label}: unknown feature "${String(feature)}"`)
    }
    if (island.csp?.wasm !== undefined && island.csp.wasm !== true) errors.push(`${label}: csp.wasm must be true or absent`)
    errors.push(...sourceErrors(`${label}: csp.connectSrc`, island.csp?.connectSrc), ...sourceErrors(`${label}: csp.workerSrc`, island.csp?.workerSrc))
  }
  return errors
}
