import { z } from 'zod'
import type { CatalogueInstalledTheme, CatalogueReport, CatalogueTheme, CatalogueUpdate, CatalogueVersion, ContrastModeReport, ContrastPairResult, ContrastReportResponse, ThemeCatalogue, ThemeStatus } from '~/interfaces/theme'
import { responseSchema } from './response'

const requested = z.strictObject({ id: z.string(), version: z.string().optional(), digest: z.string().optional() })
const identity = z.strictObject({ id: z.string(), version: z.string().optional(), digest: z.string(), packageDigest: z.string() })

/** The answer of `GET /api/theme/status`. */
export const themeStatusSchema = responseSchema<ThemeStatus>()(
  z.strictObject({
    active: identity.meta({ description: 'The theme every page renders now.' }),
    requested: requested.nullable().meta({ description: 'What the site settings name now; `null` when they name none and the instance default applies.' }),
    lastGood: identity.nullable().meta({ description: 'The theme that was active before the last switch.' }),
    error: z.strictObject({
      rule: z.enum(['pin', 'unknown', 'code', 'off', 'tier', 'limit', 'registry', 'install', 'integrity']),
      message: z.string(),
      at: z.string(),
      requested: requested.nullable(),
    }).nullable().meta({ description: 'Why the last attempt to switch failed, until a later one succeeds; the active theme stays meanwhile. The message is one line with no URL and no path.' }),
    available: z.strictObject({
      builtIn: z.array(z.strictObject({ id: z.string(), version: z.string().optional(), code: z.boolean() })),
      registry: z.strictObject({ install: z.boolean(), tiers: z.array(z.string()) }),
    }).meta({ description: 'What this image can activate: the themes compiled into it (a code theme only from here) and whether data-only themes are installed from the registry, with the tiers allowed.' }),
  }).meta({ id: 'ThemeStatus', description: 'The theme the server renders, the one the site settings ask for, and why a switch did not happen.' }),
)

const tier = z.enum(['official', 'verified', 'community'])

const catalogueInstalled = responseSchema<CatalogueInstalledTheme>()(
  z.strictObject({
    id: z.string(),
    version: z.string(),
    packageDigest: z.string(),
    contract: z.string(),
    code: z.boolean(),
    store: z.enum(['built-in', 'deployment']),
    tier: tier.optional(),
    license: z.string().optional(),
    report: z.string().optional(),
  }).meta({ id: 'CatalogueInstalledTheme', description: 'A theme of the built-in or the deployment store; `tier`, `license` and `report` come from the index when it lists this version with this package digest.' }),
)

const catalogueVersion = responseSchema<CatalogueVersion>()(
  z.strictObject({
    version: z.string(),
    digest: z.string(),
    contract: z.string(),
    license: z.string(),
    tier,
    distribution: z.enum(['public', 'licensed']),
    status: z.enum(['published', 'yanked', 'incompatible']),
    code: z.boolean(),
    report: z.string().optional(),
    runs: z.boolean().meta({ description: 'Whether this core implements the contract of the version and the index does not mark it incompatible with this core.' }),
  }).meta({ id: 'CatalogueVersion', description: 'A version of the index, as the index lists it, with whether this core runs it.' }),
)

const catalogueTheme = responseSchema<CatalogueTheme>()(
  z.strictObject({ id: z.string(), versions: z.array(catalogueVersion) }).meta({ id: 'CatalogueTheme', description: 'A theme of the index, its versions newest first.' }),
)

const catalogueUpdate = responseSchema<CatalogueUpdate>()(
  z.strictObject({ id: z.string(), from: z.string(), store: z.enum(['built-in', 'deployment']), version: z.string(), digest: z.string() })
    .meta({ id: 'CatalogueUpdate', description: 'The newest version of the index that is published, newer than the installed `from` and runs on this core.' }),
)

const catalogueReport = responseSchema<CatalogueReport>()(
  z.strictObject({ id: z.string(), version: z.string(), digest: z.string(), ok: z.boolean(), summary: z.string() })
    .meta({ id: 'CatalogueReport', description: 'The result and the Markdown summary of an admission report, read from the registry after its bytes matched the digest the index names.' }),
)

/** The answer of `GET /api/theme/catalogue`. */
export const themeCatalogueSchema = responseSchema<ThemeCatalogue>()(
  z.strictObject({
    installed: z.array(catalogueInstalled),
    registry: z.array(catalogueTheme).nullable().meta({ description: 'The themes of the verified index; `null` when the index has not been read or did not verify.' }),
    reason: z.string().nullable().meta({ description: 'Why the last read of the index failed, or why none is made, as one line with no URL and no path; `null` after a read that succeeded.' }),
    updates: z.array(catalogueUpdate),
    reports: z.array(catalogueReport).max(50),
  }).meta({ id: 'ThemeCatalogue', description: 'The installed themes, the registry\'s themes, the updates and the admission reports, built in the background from the signed index and the stores.' }),
)

const contrastPair = responseSchema<ContrastPairResult>()(
  z.strictObject({
    role: z.string(),
    surface: z.string(),
    ratio: z.number().nullable().meta({ description: 'The WCAG 2 ratio floored to two decimals, as `theme:check` prints it; `null` when a color cannot be measured.' }),
    min: z.number(),
    passes: z.boolean().meta({ description: 'Whether the unrounded ratio reaches `min`.' }),
  }).meta({ id: 'ContrastPairResult', description: 'One pair of the contrast matrix of ADR 0005, section 1: a foreground role on a surface.' }),
)

const accentColors = z.strictObject({ accent: z.string(), accentSoft: z.string(), accentHover: z.string(), onAccent: z.string() })

/** The answer of `GET /_micelio/contrast`. */
export const contrastReportResponseSchema = responseSchema<ContrastReportResponse>()(
  z.strictObject({
    data: z.strictObject({
      theme: z.string().meta({ description: 'The id of the active theme.' }),
      modes: z.array(responseSchema<ContrastModeReport>()(z.strictObject({
        mode: z.string(),
        accent: accentColors.nullable().meta({ description: 'The accent family the candidate resolves to after the contrast adjustment of ADR 0005 section 8, as `#rrggbb`; `null` when the theme\'s own accent stays.' }),
        pairs: z.array(contrastPair).meta({ description: 'Every pair of the matrix of `theme:check` for the theme\'s contract, in its order.' }),
      }).meta({ id: 'ContrastModeReport' }))),
    }),
  }).meta({ id: 'ContrastReportResponse', description: 'The contrast matrix of the active theme in every mode, with the candidate accents applied.' }),
)
