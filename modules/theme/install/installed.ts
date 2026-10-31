import { pinProblem } from '../registry/pin'
import type { ThemePin } from '../registry/types'
import { InstallError } from './error'
import { compileKey, compiledDigest } from './key'
import { loadEntry, readKeptPackage } from './store'
import type { LoadedEntry } from './types'

/**
 * The compiled entry of a pinned package, when the store holds it as an installed theme, or `null`.
 *
 * @remarks
 * ADR 0009, section 1: an entry counts as installed only when its package digest is the pin, the kept package hashes to that digest
 * (a planted folder with a matching manifest and no verified package is not installed), the compile key is this core's, `verify`
 * accepts the kept attestation bundle when given, and then the manifest verifies. Anything less answers `null`.
 *
 * @param verify - Verifies the kept attestation bundle offline; it throws to refuse. A caller that requires attestations passes it.
 */
export async function installedEntry(storeDir: string, pin: ThemePin, coreBuild: string, verify?: (bundle: Uint8Array) => void): Promise<LoadedEntry | null> {
  if (pinProblem(pin) !== null) return null
  const kept = await readKeptPackage(storeDir, pin.digest)
  if (kept === null) return null
  if (verify) {
    if (kept.attestation === null) return null
    try {
      verify(kept.attestation)
    } catch {
      return null
    }
  }
  let entry: LoadedEntry | null
  try {
    entry = await loadEntry(storeDir, compiledDigest(pin.digest, compileKey(coreBuild)))
  } catch (error) {
    if (error instanceof InstallError) return null
    throw error
  }
  if (entry === null || entry.manifest.packageDigest !== pin.digest || entry.manifest.origin !== 'package') return null
  return entry
}
