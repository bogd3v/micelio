import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { randomBytes } from 'node:crypto'
import { parseContractVersion } from '../version'
import { CONTRACT_VERSION } from '../constants'
import { THEME_JSON } from './constants'
import { RegistryError } from './error'
import type { ThemePin, UnpackedTheme } from './types'

/**
 * Checks that an unpacked package is the theme its pin names and that this core can run its contract.
 *
 * @remarks
 * The digest already ties the bytes to the pin; this stops a registry that serves a different, validly packed theme under a pin.
 *
 * @throws `RegistryError` (`identity`) when `theme.json` names another id or version, (`contract`) when it declares a newer one.
 */
export function checkIdentity(pin: ThemePin, unpacked: UnpackedTheme): { contract: string } {
  let manifest: Record<string, unknown>
  try {
    manifest = JSON.parse(new TextDecoder().decode(unpacked.files.get(THEME_JSON))) as Record<string, unknown>
  } catch (error) {
    throw new RegistryError('identity', 'theme.json is not valid JSON', pin, { cause: error })
  }
  if (manifest.id !== pin.id || manifest.version !== pin.version) {
    throw new RegistryError('identity', `the package says it is ${String(manifest.id)}@${String(manifest.version)}`, pin)
  }
  const contract = parseContractVersion(manifest.contract)
  if (!contract) throw new RegistryError('contract', 'theme.json declares no contract version', pin)
  if (contract.major !== CONTRACT_VERSION.major || contract.minor > CONTRACT_VERSION.minor) {
    throw new RegistryError('contract', `declares contract ${contract.major}.${contract.minor}; this core implements ${CONTRACT_VERSION.major}.${CONTRACT_VERSION.minor}`, pin)
  }
  return { contract: `${contract.major}.${contract.minor}` }
}

/**
 * Writes the files of an unpacked theme to `<root>/<id>/`, replacing what was there.
 *
 * @remarks
 * The files go to a sibling temporary directory first and are renamed into place, so the folder is never half written. Paths
 * were already restricted by the unpack; each one is checked again to stay inside the folder. Nothing is executed or imported.
 *
 * @returns The directory written.
 */
export function writeTheme(root: string, id: string, unpacked: UnpackedTheme): string {
  const target = resolve(root, id)
  const staging = resolve(root, `.${id}.${randomBytes(6).toString('hex')}.tmp`)
  mkdirSync(root, { recursive: true })
  try {
    for (const [path, data] of unpacked.files) {
      const file = resolve(staging, path)
      if (!file.startsWith(`${staging}${sep}`)) throw new RegistryError('identity', 'a file would be written outside the theme folder', { id })
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, data, { mode: 0o644, flag: 'wx' })
    }
    rmSync(target, { recursive: true, force: true })
    renameSync(staging, target)
  } catch (error) {
    rmSync(staging, { recursive: true, force: true })
    throw error
  }
  return join(root, id)
}
