import { isDeepStrictEqual } from 'node:util'
import { THEME_ID, THEME_VERSION, VERSION_MAX_LENGTH } from '../constants'
import { INDEX_REPOSITORY, MAX_INDEX_BYTES } from '../registry/constants'
import { parseIndex } from '../registry/registry-index'
import type { IndexVersion, RegistryIndex } from '../registry/types'
import { MAX_REASON_LENGTH, PUBLISH_TIER } from './constants'
import { PublishError } from './error'

// The changes the publish workflows make to the index (ADR 0008, section 4): add a version, yank one. Pure functions over the
// parsed document; reading and writing the registry is `update.ts`.

/** The index of a registry that has no theme yet. */
export const EMPTY_INDEX: RegistryIndex = { version: 1, themes: {} }

function assertName(id: string, version: string): void {
  if (!THEME_ID.test(id) || id === INDEX_REPOSITORY) throw new PublishError(`"${id.slice(0, 64)}" is not a theme id`)
  if (version.length > VERSION_MAX_LENGTH || !THEME_VERSION.test(version)) throw new PublishError(`"${version.slice(0, 64)}" is not a semver version`)
}

/**
 * The index with a new version listed.
 *
 * @throws `PublishError` when `<id>@<version>` is already listed, whatever its status: a published version never changes, and a fix is a new version.
 */
export function addVersion(index: RegistryIndex, id: string, version: string, entry: IndexVersion): RegistryIndex {
  assertName(id, version)
  const theme = Object.hasOwn(index.themes, id) ? index.themes[id] : undefined
  if (theme && Object.hasOwn(theme.versions, version)) throw new PublishError(`${id}@${version} is already published: a version never changes, publish a new version`)
  return { ...index, themes: { ...index.themes, [id]: { versions: { ...theme?.versions, [version]: entry } } } }
}

/**
 * The index with a published version marked `yanked`, with the reason and the time.
 *
 * @throws `PublishError` when the version is not listed, is not `published`, or the reason is empty, longer than 500 characters or has a control character.
 */
export function yankVersion(index: RegistryIndex, id: string, version: string, reason: string, at: Date): RegistryIndex {
  assertName(id, version)
  const text = reason.trim()
  if (text === '' || text.length > MAX_REASON_LENGTH || [...text].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) {
    throw new PublishError(`a yank needs a reason of one line, at most ${MAX_REASON_LENGTH} characters`)
  }
  const theme = Object.hasOwn(index.themes, id) ? index.themes[id] : undefined
  const current = theme && Object.hasOwn(theme.versions, version) ? theme.versions[version] : undefined
  if (!theme || !current) throw new PublishError(`${id}@${version} is not in the index`)
  if (current.status !== 'published') throw new PublishError(`${id}@${version} is ${current.status}, not published: only a published version is yanked`)
  const yanked: IndexVersion = { ...current, status: 'yanked', yank: { reason: text, at: at.toISOString() } }
  return { ...index, themes: { ...index.themes, [id]: { versions: { ...theme.versions, [version]: yanked } } } }
}

/**
 * The index with a published version marked `incompatible` from a core version on, with the reason and the time (#314).
 *
 * @throws `PublishError` when the version is not listed or is not `published`, `core` is not a version, or the reason is empty, longer than 500 characters or has a control character.
 */
export function markIncompatible(index: RegistryIndex, id: string, version: string, core: string, reason: string, at: Date): RegistryIndex {
  assertName(id, version)
  if (core.length > VERSION_MAX_LENGTH || !THEME_VERSION.test(core)) throw new PublishError(`"${core.slice(0, 64)}" is not a core version`)
  const text = reason.trim()
  if (text === '' || text.length > MAX_REASON_LENGTH || [...text].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) {
    throw new PublishError(`an incompatible mark needs a reason of one line, at most ${MAX_REASON_LENGTH} characters`)
  }
  const theme = Object.hasOwn(index.themes, id) ? index.themes[id] : undefined
  const current = theme && Object.hasOwn(theme.versions, version) ? theme.versions[version] : undefined
  if (!theme || !current) throw new PublishError(`${id}@${version} is not in the index`)
  if (current.status !== 'published') throw new PublishError(`${id}@${version} is ${current.status}, not published: only a published version is marked incompatible`)
  const marked: IndexVersion = { ...current, status: 'incompatible', incompatible: { core, reason: text, at: at.toISOString() } }
  return { ...index, themes: { ...index.themes, [id]: { versions: { ...theme.versions, [version]: marked } } } }
}

/** Whether `after` is `before` with only the mark of a yank or of an incompatibility added to a published version. */
function isAllowedMark(before: IndexVersion, after: IndexVersion): boolean {
  if (before.status !== 'published') return false
  const unmarked = { ...before, yank: undefined, incompatible: undefined }
  if (after.status === 'yanked') return after.yank !== undefined && after.incompatible === undefined && isDeepStrictEqual({ ...after, status: 'published', yank: undefined, incompatible: undefined }, unmarked)
  if (after.status === 'incompatible') return after.incompatible !== undefined && after.yank === undefined && isDeepStrictEqual({ ...after, status: 'published', yank: undefined, incompatible: undefined }, unmarked)
  return false
}

/**
 * What differs between two indexes beyond what the publish workflows may do, one line each; empty when `next` is a valid successor of `previous`.
 *
 * @remarks
 * The signing workflow runs this on its own: it vouches for `next` only if every listed version is unchanged except that a
 * `published` one became `yanked` with a reason or `incompatible` from a core version, and every new version is an `official`, `public`, `published` one.
 */
export function successorProblems(previous: RegistryIndex, next: RegistryIndex): string[] {
  const problems: string[] = []
  for (const [id, theme] of Object.entries(previous.themes)) {
    for (const [version, before] of Object.entries(theme.versions)) {
      const after = Object.hasOwn(next.themes, id) && Object.hasOwn(next.themes[id]!.versions, version) ? next.themes[id]!.versions[version] : undefined
      if (!after) problems.push(`${id}@${version} was removed`)
      else if (isDeepStrictEqual(before, after)) continue
      else if (!isAllowedMark(before, after)) problems.push(`${id}@${version} was changed`)
    }
  }
  for (const [id, theme] of Object.entries(next.themes)) {
    for (const [version, entry] of Object.entries(theme.versions)) {
      if (Object.hasOwn(previous.themes, id) && Object.hasOwn(previous.themes[id]!.versions, version)) continue
      if (entry.status !== 'published' || entry.tier !== PUBLISH_TIER || entry.distribution !== 'public' || entry.yank || entry.incompatible) problems.push(`${id}@${version} is new and not an official, public, published version`)
    }
  }
  return problems
}

/**
 * The text of an index, validated as a client reads it: sorted, two-space indented and ending in a newline, so the same index is the same bytes.
 *
 * @throws `RegistryError` when the index is not valid, `PublishError` when it is larger than a client reads.
 */
export function serializeIndex(index: RegistryIndex): string {
  const sorted: RegistryIndex = { version: 1, themes: {} }
  for (const id of Object.keys(index.themes).sort()) {
    const versions = index.themes[id]!.versions
    sorted.themes[id] = { versions: Object.fromEntries(Object.keys(versions).sort().map(version => [version, versions[version]!])) }
  }
  const text = `${JSON.stringify(sorted, null, 2)}\n`
  parseIndex(text)
  if (Buffer.byteLength(text) > MAX_INDEX_BYTES) throw new PublishError(`the index would be larger than the ${MAX_INDEX_BYTES} bytes a client reads`)
  return text
}
