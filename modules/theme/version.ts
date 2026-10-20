import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { CONTRACT_ADDITIONS, CONTRACT_VERSION, LAYOUT_REGIONS } from './constants'
import { checkThemeCss } from './css-rules'
import type { ContractAddition, ContractUsage, ContractVersion, Hooks, InstalledTheme } from './types'

// ADR 0008, decision 2: a theme declares the contract minor it needs, and the validator computes the lowest minor its content allows

const VERSION = /^(\d+)\.(0|[1-9]\d*)$/
const ROLE_GROUPS = ['color', 'shadow', 'spacing', 'radius', 'size', 'motion'] as const

/** Reads `N` (meaning `N.0`) or `"N.M"`; `null` for anything else. */
export function parseContractVersion(value: unknown): ContractVersion | null {
  if (typeof value === 'number') return Number.isInteger(value) && value >= 0 ? { major: value, minor: 0 } : null
  const match = typeof value === 'string' ? VERSION.exec(value) : null
  return match ? { major: Number(match[1]), minor: Number(match[2]) } : null
}

/** A contract version as `major.minor`. */
export function formatContractVersion(version: ContractVersion): string {
  return `${version.major}.${version.minor}`
}

/** The names a theme uses of everything a contract minor can add, by kind. */
function usedNames(theme: InstalledTheme, hooks: ReadonlySet<string>): Record<ContractAddition['kind'], Set<string>> {
  const { manifest, dir } = theme
  const slots = new Set<string>(Object.keys(manifest.slots ?? {}))
  const slotsDir = join(dir, 'slots')
  if (existsSync(slotsDir)) {
    for (const file of readdirSync(slotsDir)) if (file.endsWith('.vue')) slots.add(file.slice(0, -4))
  }
  const variants = new Set<string>()
  for (const region of LAYOUT_REGIONS) {
    const variant = manifest.layout?.[region]
    if (variant) variants.add(`${region}:${variant}`)
  }
  const roles = new Set<string>()
  for (const group of ROLE_GROUPS) for (const token of manifest[group]?.tokens ?? []) roles.add(token.name)
  return { 'slot': slots, 'layout variant': variants, 'role': roles, 'hook': new Set(hooks) }
}

/** The public hooks a theme's stylesheets select; parsed only when some minor added a hook. */
function selectedHooks(theme: InstalledTheme, hooks: Hooks, additions: readonly ContractAddition[]): Set<string> {
  const used = new Set<string>()
  if (additions.some(addition => addition.kind === 'hook')) checkThemeCss({ themeId: theme.id, themeDir: theme.dir, hooks, usedHooks: used })
  return used
}

/** The additions a theme uses and the lowest minor it can declare for them (0 when it uses none). */
function usedAdditions(theme: InstalledTheme, hooks: Hooks, additions: readonly ContractAddition[]): { minor: number, features: ContractAddition[] } {
  const names = usedNames(theme, selectedHooks(theme, hooks, additions))
  const features = additions.filter(addition => names[addition.kind].has(addition.name))
  return { minor: Math.max(0, ...features.map(feature => feature.minor)), features }
}

/**
 * The contract a valid theme declares, the lowest it can declare for what it uses, and what the core implements.
 *
 * @remarks
 * `npm run theme:check -- --json` reports it as `contract.declared`, `contract.used` and `contract.core`.
 *
 * @param theme - A theme that passed `contractProblems`.
 * @param additions - What the minors added; the core's own list by default.
 */
export function contractUsage(theme: InstalledTheme, hooks: Hooks, additions: readonly ContractAddition[] = CONTRACT_ADDITIONS): ContractUsage {
  const declared = parseContractVersion(theme.manifest.contract) ?? CONTRACT_VERSION
  const { minor } = usedAdditions(theme, hooks, additions)
  return {
    declared: formatContractVersion(declared),
    used: formatContractVersion({ major: CONTRACT_VERSION.major, minor }),
    core: formatContractVersion(CONTRACT_VERSION),
  }
}

/**
 * Problems when a theme declares a lower minor than the one it uses: a theme cannot under-declare.
 *
 * @param theme - A theme that passed `contractProblems`.
 * @param additions - What the minors added; the core's own list by default.
 */
export function contractUsageProblems(theme: InstalledTheme, hooks: Hooks, additions: readonly ContractAddition[] = CONTRACT_ADDITIONS): string[] {
  const declared = parseContractVersion(theme.manifest.contract)
  if (!declared) return []
  const { minor, features } = usedAdditions(theme, hooks, additions)
  if (minor <= declared.minor) return []
  const needed = features.filter(feature => feature.minor > declared.minor)
  const used = formatContractVersion({ major: declared.major, minor })
  return [`declares contract ${formatContractVersion(declared)} but uses ${used} (added after ${formatContractVersion(declared)}: ${needed.map(feature => `${feature.kind} ${feature.name} in ${declared.major}.${feature.minor}`).join(', ')})`]
}
