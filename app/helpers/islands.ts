/** Island id -> file name under `/_islands/`, written by `modules/islands.ts` (ADR 0006, section 3). */
export type IslandManifest = Readonly<Record<string, string>>

export const ISLANDS_PATH = '/_islands/'

/** Public URL of an island's script, or undefined when the build did not produce it. `baseURL` is `app.baseURL`. */
export function islandSrc(manifest: IslandManifest, id: string, baseURL = '/'): string | undefined {
  const file = Object.hasOwn(manifest, id) ? manifest[id] : undefined
  if (!file) return undefined
  return `${baseURL.replace(/\/+$/, '')}${ISLANDS_PATH}${file}`
}

/** A page that renders a heavy island declares it in a JSON script with this id prefix; `app/islands/loader.ts` reads them. */
export const HEAVY_SCRIPT_PREFIX = 'micelio-island-'
/** Dispatched on `document` when a client-side navigation renders a heavy island. */
export const HEAVY_SCAN_EVENT = 'micelio:heavy-scan'

export interface HeavyDeclaration {
  /** The custom element the island upgrades. */
  tag: string
  /** Path of the island's entry under `/_islands/`. */
  src: string
}

// A same-site path to a file of /_islands/ (app.baseURL in front), never a URL taken from the markup
const ENTRY_PATH = /^\/(?:[\w.-]+\/)*_islands\/[\w.-]+\.js$/
const TAG_NAME = /^micelio-[a-z][a-z0-9-]*$/

/** JSON of a heavy island's script: the loader's fields and the island's own `config`. `<` is escaped, so the text cannot close the script element. */
export function heavyDeclarationJson(declaration: HeavyDeclaration, config: object = {}): string {
  return JSON.stringify({ ...config, ...declaration }).replaceAll('<', '\\u003c')
}

/** The declaration in a script's text, or undefined when it is malformed or points anywhere but /_islands/. */
export function parseHeavyDeclaration(json: string | null | undefined): HeavyDeclaration | undefined {
  try {
    const data = JSON.parse(json ?? '') as Partial<HeavyDeclaration> | null
    if (typeof data?.tag === 'string' && typeof data.src === 'string' && TAG_NAME.test(data.tag) && ENTRY_PATH.test(data.src)) return { tag: data.tag, src: data.src }
  } catch {
    // Malformed: the island stays on its fallback
  }
  return undefined
}
