/** Island id to file name under `/_islands/`, written by `modules/islands.ts` (ADR 0006, section 3). */
export type IslandManifest = Readonly<Record<string, string>>

/** Folder of the built island scripts, relative to `app.baseURL`. */
export const ISLANDS_PATH = '/_islands/'

/** Public URL of an island's script, or undefined when the build did not produce it. `baseURL` is `app.baseURL`. */
export function islandSrc(manifest: IslandManifest, id: string, baseURL = '/'): string | undefined {
  const file = Object.hasOwn(manifest, id) ? manifest[id] : undefined
  if (!file) return undefined
  return `${baseURL.replace(/\/+$/, '')}${ISLANDS_PATH}${file}`
}

/** The declaration of a heavy island, written as JSON in its `<script>` element and read by `parseHeavyDeclaration()`. */
export interface HeavyDeclaration {
  /** The registry id; the element it upgrades is `heavyTag(id)`. */
  id: string
  /** `visible` loads the island when its element is in view; `interaction` waits for a press on `control`. */
  trigger: 'visible' | 'interaction'
  /** What `Save-Data` does to a `visible` island. */
  saveData: 'load' | 'skip'
  /** Path of the island's entry under `/_islands/`. */
  src: string
  /** `interaction` only: selector, inside the element, of the control whose press loads the entry. */
  control?: string
  /** The island animates: `prefers-reduced-motion: reduce` keeps the fallback. */
  motion?: true
  /** What the browser must have for the island to run; without it the fallback stays. */
  features: string[]
}

/** The custom element of a heavy island. */
export function heavyTag(id: string): string {
  return `micelio-${id}`
}

// A same-site path to a file of /_islands/ (app.baseURL in front), never a URL taken from the markup
const ENTRY_PATH = /^\/(?:[\w.-]+\/)*_islands\/[\w.-]+\.js$/
// An attribute selector of ours (the same rule as the registry's), never free CSS
const CONTROL = /^\[data-[a-z][a-z-]*\]$/
const FEATURE = /^[a-z0-9]+$/
const ISLAND_ID = /^[a-z][a-z0-9-]*$/

/** JSON of a heavy island's script: the loader's fields and the island's own `config`. `<` is escaped, so the text cannot close the script element. */
export function heavyDeclarationJson(declaration: HeavyDeclaration, config: object = {}): string {
  return JSON.stringify({ ...config, ...declaration }).replaceAll('<', '\\u003c')
}

/** The declaration in a script's text, or undefined when it is malformed or points anywhere but /_islands/. */
export function parseHeavyDeclaration(json: string | null | undefined): HeavyDeclaration | undefined {
  try {
    const data = JSON.parse(json ?? '') as Partial<HeavyDeclaration> | null
    if (typeof data?.id !== 'string' || typeof data.src !== 'string' || !ISLAND_ID.test(data.id) || !ENTRY_PATH.test(data.src)) return undefined
    if (data.trigger !== 'visible' && data.trigger !== 'interaction') return undefined
    const features = Array.isArray(data.features) ? data.features.filter((feature): feature is string => typeof feature === 'string' && FEATURE.test(feature)) : []
    const declaration: HeavyDeclaration = { id: data.id, trigger: data.trigger, saveData: data.saveData === 'load' ? 'load' : 'skip', src: data.src, features }
    if (data.motion === true) declaration.motion = true
    if (data.trigger === 'interaction') {
      // An interaction island without a usable control has nothing to wait for
      if (typeof data.control !== 'string' || !CONTROL.test(data.control)) return undefined
      declaration.control = data.control
    }
    return declaration
  } catch {
    // Malformed: the island stays on its fallback
  }
  return undefined
}
