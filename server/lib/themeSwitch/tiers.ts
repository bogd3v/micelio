import { DEFAULT_TIERS } from './constants'

const SERVER_TIERS = new Set(['official', 'verified', 'community'])

/**
 * The tiers of ADR 0008 (decision 7) a server may install, from `MICELIO_THEME_TIERS`: a comma-separated list, `official,verified` when it is unset or blank.
 *
 * @remarks
 * A package of any other tier is refused at install with a reason that names its tier. `local` is not a tier a registry has.
 *
 * @param value - The runtime value of `MICELIO_THEME_TIERS`.
 * @throws `Error` naming `MICELIO_THEME_TIERS` when the list holds a tier that does not exist, so the boot stops.
 */
export function readTiers(value: string | undefined): ReadonlySet<string> {
  const names = (value ?? '').split(',').map(name => name.trim()).filter(Boolean)
  if (names.length === 0) return new Set(DEFAULT_TIERS)
  for (const name of names) {
    if (!SERVER_TIERS.has(name)) throw new Error(`MICELIO_THEME_TIERS names an unknown tier "${name.slice(0, 40)}"; the tiers are ${[...SERVER_TIERS].join(', ')}`)
  }
  return new Set(names)
}
