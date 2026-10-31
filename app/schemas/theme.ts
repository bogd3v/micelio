import { z } from 'zod'
import type { ThemeStatus } from '~/interfaces/theme'
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
