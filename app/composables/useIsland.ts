import manifest from '#build/micelio/islands'
import { islandSrc } from '~/helpers/islands'

/**
 * Adds the script of an island (`app/islands/<id>.ts`) to this page only: a plain module script, never preloaded.
 * The component calling it renders the island's complete server markup (ADR 0006, section 3).
 */
export function useIsland(id: string): void {
  const src = islandSrc(manifest, id, useRuntimeConfig().app.baseURL)
  if (src) useHead({ script: [{ src, type: 'module' }] })
}
