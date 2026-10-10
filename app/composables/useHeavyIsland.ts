import manifest from '#build/micelio/islands'
import { HEAVY_ISLANDS, HEAVY_SCAN_EVENT, HEAVY_SCRIPT_PREFIX } from '~/islands/lib/constants'
import { heavyDeclarationJson, islandSrc } from '~/helpers/islands'

/**
 * Declares a heavy island of the registry (`HEAVY_ISLANDS` in `app/islands/lib/constants.ts`) on this page. Its own script is not added: the loader
 * (`app/islands/loader.ts`) imports it on the island's trigger, for the element `micelio-<id>`. `config` is the island's own
 * settings, read from the same JSON script.
 */
export function useHeavyIsland(id: string, config: object = {}): void {
  const island = HEAVY_ISLANDS.find(item => item.id === id)
  const src = islandSrc(manifest, island?.entry ?? id, useRuntimeConfig().app.baseURL)
  if (!island || !src) return
  useIsland('loader')
  const declaration = { id, trigger: island.trigger, saveData: island.saveData ?? 'skip', src, features: island.features, ...(island.control && { control: island.control }), ...(island.motion && { motion: true as const }) }
  useHead({ script: [{ key: `${HEAVY_SCRIPT_PREFIX}${id}`, id: `${HEAVY_SCRIPT_PREFIX}${id}`, type: 'application/json', innerHTML: heavyDeclarationJson(declaration, config) }] })
  // A client-side navigation to a page with the island: the loader may be running already
  onMounted(() => document.dispatchEvent(new Event(HEAVY_SCAN_EVENT)))
}
