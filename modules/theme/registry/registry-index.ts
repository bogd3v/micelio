import { z } from 'zod'
import { THEME_ID, THEME_VERSION, VERSION_MAX_LENGTH } from '../constants'
import { parseContractVersion } from '../version'
import { ATTESTATION_TAG_SUFFIX, THEME_DIGEST } from './constants'
import { RegistryError } from './error'
import type { RegistryIndex } from './types'

// The index of the registry (ADR 0008, section 4): every theme and version with its digest, contract, tier, distribution and status.
// `theme:publish` (#312) writes it and `themes/registry-index.schema.json` is generated from this schema (`npm run theme:schema`). The
// client ignores fields it does not know, so the format can grow. The signature is not a field: it is a Sigstore bundle at `index:v1.att`.

const MAX_THEMES = 10_000
const MAX_VERSIONS = 1000

const Version = z.object({
  digest: z.string().regex(THEME_DIGEST).describe('The `sha256:` digest of the `.tgz`, which is also the digest of the package artifact\'s layer.'),
  contract: z.string().refine(value => parseContractVersion(value) !== null, { error: 'must be major.minor' }).describe('The theme contract the version declares, as `major.minor`.'),
  license: z.string().max(128).describe('The SPDX id (or `LicenseRef-*`) from the package\'s `theme.json`.'),
  tier: z.enum(['official', 'verified', 'community']).describe('Who stands behind the version (ADR 0008, decision 7); the publish workflow writes only `official`.'),
  distribution: z.enum(['public', 'licensed']),
  status: z.enum(['published', 'yanked', 'incompatible']).describe('`yanked` stays pullable for locks that pin it and is never resolved for a new range.'),
  code: z.boolean().describe('Whether the package ships `slots/` or `templates/`, which only an image built with it can run (ADR 0009, section 4).'),
  report: z.string().max(512).optional().describe('The `sha256:` digest of the admission report attached to the package artifact as a referrer.'),
  yank: z.object({ reason: z.string().min(1).max(500), at: z.iso.datetime() }).optional().describe('Why and when the version was yanked; present only with status `yanked`.'),
  incompatible: z.object({
    core: z.string().max(VERSION_MAX_LENGTH).regex(THEME_VERSION).describe('The first core version the version fails on, as `X.Y.Z`; a core below it still installs the version.'),
    reason: z.string().min(1).max(500),
    at: z.iso.datetime(),
  }).optional().describe('From which core, why and when the version was marked incompatible; present only with status `incompatible` (#314). An `incompatible` entry without it is incompatible with every core.'),
})

/** The schema of the index document. */
export const IndexSchema = z.object({
  version: z.literal(1).describe('The format of the index, which is also the tag it is published under (`index:v1`).'),
  themes: z.record(z.string(), z.object({ versions: z.record(z.string(), Version) })),
}).describe('The index of the registry: `themes[id].versions[version]` (ADR 0008, section 4).')

/** The JSON Schema of the index, written to `themes/registry-index.schema.json`. */
export function registryIndexJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(IndexSchema, { target: 'draft-2020-12', unrepresentable: 'any' }) as Record<string, unknown>
  return {
    ...schema,
    $id: 'https://github.com/bogd3v/micelio/blob/main/themes/registry-index.schema.json',
    title: 'Micelio theme registry index (version 1)',
  }
}

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
  const parsed = IndexSchema.safeParse(value)
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
