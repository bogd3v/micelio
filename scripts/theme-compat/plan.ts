import { compareVersions } from '../../modules/theme/registry/semver'
import type { RegistryIndex } from '../../modules/theme/registry/types'

// What the compatibility check (#314) looks at: the latest version of every theme in the index that is not yanked, and the commit it was built from.

/** One theme version to check against a core. */
export interface CompatEntry {
  id: string
  version: string
  tier: 'official' | 'verified' | 'community'
  /** The `sha256:` digest of the package the index lists. */
  digest: string
  /** What the index says about it now: `incompatible` ones are checked again, but never marked twice. */
  status: 'published' | 'incompatible'
}

/**
 * The latest non-yanked version of every public theme of the index, sorted by id.
 *
 * @remarks
 * A `licensed` version has no package to download, so it is left out. A theme whose every version is yanked has nothing to check.
 */
export function planThemes(index: RegistryIndex): CompatEntry[] {
  const entries: CompatEntry[] = []
  for (const id of Object.keys(index.themes).sort()) {
    const candidates = Object.entries(index.themes[id]!.versions).filter(([, entry]) => entry.status !== 'yanked' && entry.distribution === 'public')
    const latest = candidates.sort(([a], [b]) => compareVersions(a, b)).at(-1)
    if (latest) entries.push({ id, version: latest[0], tier: latest[1].tier, digest: latest[1].digest, status: latest[1].status === 'incompatible' ? 'incompatible' : 'published' })
  }
  return entries
}

/** Where a published version was built from: the repository and the commit its signed provenance names. */
export interface SourceCommit {
  repository: string
  commit: string
}

/**
 * The commit a package was built from, read from its provenance bundle, or the reason there is none.
 *
 * @remarks
 * The bundle must already be verified (`createRegistry(...).fetch` does): the statement is then the one the publish workflow signed.
 * It is a SLSA v1 provenance whose `resolvedDependencies` name `git+https://github.com/<repository>@<ref>` with a `gitCommit`.
 * The repository must be `expected`: the themes of the registry are published from one repository, and a commit of any other is not their source.
 */
export function sourceOf(bundle: Uint8Array, expected: string): SourceCommit | { reason: string } {
  let statement: { predicate?: { buildDefinition?: { resolvedDependencies?: Array<{ uri?: unknown, digest?: { gitCommit?: unknown } }> } } }
  try {
    const envelope = (JSON.parse(Buffer.from(bundle).toString('utf8')) as { dsseEnvelope?: { payload?: string } }).dsseEnvelope
    statement = JSON.parse(Buffer.from(envelope?.payload ?? '', 'base64').toString('utf8')) as typeof statement
  } catch {
    return { reason: 'its provenance cannot be read' }
  }
  for (const dependency of statement.predicate?.buildDefinition?.resolvedDependencies ?? []) {
    const match = typeof dependency.uri === 'string' ? /^git\+https:\/\/github\.com\/([^@/]+\/[^@/]+)@/.exec(dependency.uri) : null
    const commit = dependency.digest?.gitCommit
    if (!match || typeof commit !== 'string') continue
    if (match[1] !== expected) return { reason: `its provenance names ${match[1]?.slice(0, 80)}, not ${expected}` }
    if (!/^[0-9a-f]{40}$/.test(commit)) return { reason: 'its provenance names a commit that is not a full SHA' }
    return { repository: match[1], commit }
  }
  return { reason: 'its provenance names no source commit' }
}
