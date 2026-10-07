/** Island id -> file name under `/_islands/`, written by `modules/islands.ts` (ADR 0006, section 3). */
export type IslandManifest = Readonly<Record<string, string>>

export const ISLANDS_PATH = '/_islands/'

/** Public URL of an island's script, or undefined when the build did not produce it. `baseURL` is `app.baseURL`. */
export function islandSrc(manifest: IslandManifest, id: string, baseURL = '/'): string | undefined {
  const file = Object.hasOwn(manifest, id) ? manifest[id] : undefined
  if (!file) return undefined
  return `${baseURL.replace(/\/+$/, '')}${ISLANDS_PATH}${file}`
}
