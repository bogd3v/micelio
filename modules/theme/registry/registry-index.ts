import { z } from 'zod'
import { THEME_ID, THEME_VERSION, VERSION_MAX_LENGTH } from '../constants'
import { parseContractVersion } from '../version'
import { ATTESTATION_TAG_SUFFIX, THEME_DIGEST } from './constants'
import { RegistryError } from './error'

// The index of the registry (ADR 0008, section 4): every theme and version with its digest, contract, tier, distribution and status.
// #312 writes it; this is the shape the client accepts. Fields it does not know are ignored, so the format can grow.

const MAX_THEMES = 10_000
const MAX_VERSIONS = 1000

const Version = z.object({
  digest: z.string().regex(THEME_DIGEST),
  contract: z.string().refine(value => parseContractVersion(value) !== null, { error: 'must be major.minor' }),
  license: z.string().max(128),
  tier: z.enum(['official', 'verified', 'community']),
  distribution: z.enum(['public', 'licensed']),
  status: z.enum(['published', 'yanked', 'incompatible']),
  code: z.boolean(),
  report: z.string().max(512).optional(),
})

/** One version of a theme in the index. */
export type IndexVersion = z.infer<typeof Version>

/** The index: `themes[id].versions[version]`. */
export interface RegistryIndex {
  version: 1
  themes: Record<string, { versions: Record<string, IndexVersion> }>
}

const Index = z.object({
  version: z.literal(1),
  themes: z.record(z.string(), z.object({ versions: z.record(z.string(), Version) })),
})

/**
 * Reads and validates the text of the index.
 *
 * @remarks
 * Every theme id and version used as a key is checked against the same grammar as a pin before the index is used, and a key that
 * does not match fails the whole index: an entry is never skipped silently.
 *
 * @throws `RegistryError` (`registry`) when the text is not an index.
 */
export function parseIndex(text: string): RegistryIndex {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    throw new RegistryError('registry', 'the index is not valid JSON', {}, { cause: error })
  }
  // zod's record skips a `__proto__` key; an index with one is refused, not read as if the entry were absent
  const raw = value as { themes?: Record<string, { versions?: Record<string, unknown> }> } | null
  const rawThemes = typeof raw?.themes === 'object' && raw.themes !== null ? raw.themes : {}
  for (const [id, theme] of Object.entries(rawThemes)) {
    const keys = [id, ...(typeof theme === 'object' && theme !== null && typeof theme.versions === 'object' && theme.versions !== null ? Object.keys(theme.versions) : [])]
    if (keys.includes('__proto__')) throw new RegistryError('registry', 'the index has a key that is not valid')
  }
  const parsed = Index.safeParse(value)
  if (!parsed.success) throw new RegistryError('registry', `the index is not valid: ${parsed.error.issues[0]?.path.join('.') || 'root'}`)
  const themes = Object.entries(parsed.data.themes)
  if (themes.length > MAX_THEMES) throw new RegistryError('registry', `the index lists more than ${MAX_THEMES} themes`)
  for (const [id, theme] of themes) {
    if (!THEME_ID.test(id)) throw new RegistryError('registry', 'the index has a theme whose id is not valid')
    const versions = Object.keys(theme.versions)
    if (versions.length > MAX_VERSIONS) throw new RegistryError('registry', `the index lists more than ${MAX_VERSIONS} versions of ${id}`)
    if (versions.some(version => version.length > VERSION_MAX_LENGTH || !THEME_VERSION.test(version) || version.endsWith(ATTESTATION_TAG_SUFFIX))) throw new RegistryError('registry', `the index has a version of ${id} that is not valid`)
  }
  return parsed.data
}
