import { z } from 'zod'
import type { ContrastModeReport, ContrastPairResult, ContrastReportResponse, ThemeStatus } from '~/interfaces/theme'
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
