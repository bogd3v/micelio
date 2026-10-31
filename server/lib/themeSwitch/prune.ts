import { join } from 'node:path'
import { compileKey } from '../../../modules/theme/install/key'
import { pruneStore } from '../../../modules/theme/install/store'
import { readInstallInputs } from '../builtInStore'
import { readPins } from './state'

/**
 * Removes from a deployment store the entries compiled for other core builds and the kept packages nothing uses (ADR 0009, open question 3).
 *
 * @remarks
 * The one cleanup there is: a request never evicts anything. The current compile key is the one of the built-in store's core build, and the
 * packages of the active and last good themes (`state.json`) are kept whatever their entries say, so a core upgrade cannot remove the way back.
 *
 * @param storeDir - `MICELIO_THEME_STORE`.
 * @param builtInDir - The built-in store of the build this store is used with (`.output/server/micelio/store`).
 * @returns The digests of the entries and of the packages removed.
 */
export async function pruneDeploymentStore(storeDir: string, builtInDir: string): Promise<{ entries: string[], packages: string[] }> {
  const pins = await readPins(storeDir)
  const keep = new Set([pins.active, pins.lastGood].flatMap(pin => (pin === null ? [] : [pin.digest])))
  return pruneStore(storeDir, compileKey(readInstallInputs(join(builtInDir)).coreBuild), keep)
}
