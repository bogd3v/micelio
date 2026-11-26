import { pinProblem } from '../registry/pin'
import type { ThemePin } from '../registry/types'
import { InstallError } from './error'
import { compileKey, compiledDigest } from './key'
import { loadEntry, packageDigestsOf, readKeptPackage, storedPins } from './store'
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

/**
 * The compiled entry of theme `id` at `version` the store holds as installed, found without a digest, or `null`.
 *
 * @remarks
 * For the preview of a theme the CMS names by id and version only (ADR 0019, amendment of 2026-11-25): each entry of this core whose
 * manifest names that version is checked as `installedEntry` checks a pin, and the first that passes is the answer.
 *
 * @param verify - Verifies the kept attestation bundle of the pin it is given; it throws to refuse.
 */
export async function installedVersion(storeDir: string, id: string, version: string, coreBuild: string, verify?: (pin: ThemePin, bundle: Uint8Array) => void): Promise<LoadedEntry | null> {
  for (const digest of await packageDigestsOf(storeDir, id, version, compileKey(coreBuild))) {
    const pin = { id, version, digest }
    const entry = await installedEntry(storeDir, pin, coreBuild, verify && (bundle => verify(pin, bundle)))
    if (entry !== null) return entry
  }
  return null
}

/**
 * Every compiled entry of this core the store holds as an installed theme, for the theme catalogue: each pin `storedPins` finds, checked as `installedEntry` checks it.
 *
 * @param verify - Verifies the kept attestation bundle of the pin it is given; it throws to refuse.
 */
export async function installedPackages(storeDir: string, coreBuild: string, verify?: (pin: ThemePin, bundle: Uint8Array) => void): Promise<LoadedEntry[]> {
  const found: LoadedEntry[] = []
  for (const pin of await storedPins(storeDir, compileKey(coreBuild))) {
    const entry = await installedEntry(storeDir, pin, coreBuild, verify && (bundle => verify(pin, bundle)))
    if (entry !== null) found.push(entry)
  }
  return found
}
