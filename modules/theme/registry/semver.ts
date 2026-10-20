import { THEME_VERSION } from '../constants'
import { RegistryError } from './error'

// Just enough semver for `theme:add <id>@<range>`: exact versions, `^`, `~`, partial versions and `*`. Not a general range parser.

type Triple = [number, number, number]

/** Splits a version into its numbers and its pre-release identifiers; `null` when it is not strict semver. */
function parse(version: string): { numbers: Triple, pre: string[] } | null {
  if (!THEME_VERSION.test(version)) return null
  const [core = '', pre] = version.split('-', 2) as [string, string | undefined]
  const numbers = core.split('.').map(Number) as Triple
  return { numbers, pre: pre === undefined ? [] : version.slice(core.length + 1).split('.') }
}

/**
 * Orders two strict semver versions: negative when `a` is lower, positive when higher (semver 2.0.0, section 11).
 *
 * @throws `RegistryError` (`pin`) when either is not a strict version.
 */
export function compareVersions(a: string, b: string): number {
  const left = parse(a)
  const right = parse(b)
  if (!left || !right) throw new RegistryError('pin', 'cannot compare a version that is not strict semver')
  for (let i = 0; i < 3; i++) if (left.numbers[i] !== right.numbers[i]) return (left.numbers[i] as number) - (right.numbers[i] as number)
  if (left.pre.length === 0 || right.pre.length === 0) return right.pre.length - left.pre.length
  for (let i = 0; i < Math.max(left.pre.length, right.pre.length); i++) {
    const x = left.pre[i]
    const y = right.pre[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    if (x === y) continue
    const xn = /^\d+$/.test(x)
    const yn = /^\d+$/.test(y)
    if (xn && yn) return Number(x) - Number(y)
    if (xn !== yn) return xn ? -1 : 1
    return x < y ? -1 : 1
  }
  return 0
}

/**
 * Whether `version` satisfies `range`: an exact version, `^1.2.3`, `~1.2.3`, a partial `1` or `1.2`, or `*` (any stable version).
 *
 * @remarks
 * A pre-release satisfies only an exact range that names it. `^0.2.3` stays below `0.3.0` and `^0.0.3` is exactly `0.0.3`, as in npm.
 *
 * @throws `RegistryError` (`pin`) when `range` is none of those.
 */
export function satisfies(version: string, range: string): boolean {
  const candidate = parse(version)
  if (!candidate) return false
  if (THEME_VERSION.test(range)) return range === version
  if (candidate.pre.length > 0) return false
  if (range === '*') return true
  const match = /^([\^~]?)(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(range)
  if (!match) throw new RegistryError('pin', `"${range.slice(0, 40)}" is not a version range (use 1.2.3, ^1.2.3, ~1.2.3, 1.2, 1 or *)`)
  const [, operator = '', major = '0', minor, patch] = match
  const [x, y, z] = candidate.numbers
  const wantMajor = Number(major)
  const wantMinor = minor === undefined ? undefined : Number(minor)
  const wantPatch = patch === undefined ? undefined : Number(patch)
  if (operator === '' && wantMinor === undefined) return x === wantMajor
  if (operator === '' && wantPatch === undefined) return x === wantMajor && y === wantMinor
  const minMinor = wantMinor ?? 0
  const minPatch = wantPatch ?? 0
  if (x !== wantMajor) return false
  if (operator === '~') return wantMinor === undefined || (y === minMinor && z >= minPatch)
  if (wantMajor > 0 || wantMinor === undefined) return y > minMinor || (y === minMinor && z >= minPatch)
  if (minMinor > 0 || wantPatch === undefined) return y === minMinor && z >= minPatch
  return y === 0 && z === minPatch
}

/**
 * The highest of `versions` that satisfies `range`, or `null` when none does.
 *
 * @throws `RegistryError` (`pin`) when `range` is not a version range.
 */
export function highestSatisfying(versions: readonly string[], range: string): string | null {
  const matching = versions.filter(version => satisfies(version, range))
  return matching.sort(compareVersions).at(-1) ?? null
}
