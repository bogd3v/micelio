// What a theme must declare to be packed (#309); the packer and the unpacker of the registry reuse it.

/** The fields of `theme.json` that packing needs, all optional for a theme that stays local. */
export interface PackMetadata {
  version?: string
  license?: string
}

/**
 * Why a theme cannot be packed yet, one line each: a missing `version` or `license`.
 *
 * @remarks
 * The format of both is checked by the contract (`contractProblems`); this only reports what is absent or empty.
 *
 * @param manifest - The `theme.json` of a theme that passed the contract.
 */
export function packProblems(manifest: PackMetadata): string[] {
  const problems: string[] = []
  if (!manifest.version) problems.push('"version" is required to pack a theme (semver, for example "1.0.0")')
  if (!manifest.license) problems.push('"license" is required to pack a theme (an SPDX id or LicenseRef-*)')
  return problems
}
