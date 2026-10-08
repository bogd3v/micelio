import manifest from '#build/micelio/islands'
import { HEAVY_SCAN_EVENT, HEAVY_SCRIPT_PREFIX, heavyDeclarationJson, islandSrc } from '~/helpers/islands'

/**
 * Declares a heavy island (`app/islands/heavy.ts`) on this page. Its own script is not added: the loader (`app/islands/loader.ts`)
 * imports it when an element named `tag` is near the viewport. `config` is the island's own settings, read from the same JSON script.
 */
export function useHeavyIsland(id: string, tag: string, config: object = {}): void {
  const src = islandSrc(manifest, id, useRuntimeConfig().app.baseURL)
  if (!src) return
  useIsland('loader')
  useHead({ script: [{ id: `${HEAVY_SCRIPT_PREFIX}${id}`, type: 'application/json', innerHTML: heavyDeclarationJson({ tag, src }, config) }] })
  // A client-side navigation to a page with the island: the loader may be running already
  onMounted(() => document.dispatchEvent(new Event(HEAVY_SCAN_EVENT)))
}
