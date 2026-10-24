import { z } from 'zod'
import { isValidEmail } from '~/helpers/auth'
import { validSecurityContact } from '~/helpers/securityTxt'
import { Locale } from '~/interfaces/locale'
import { PAGE_SLUG_PATTERN } from '~/constants/pages'
import { DISPLAY_FONTS, PRIVACY_JURISDICTIONS, SITE_MODULES, SOCIAL_NETWORKS } from '~/interfaces/site'
import type { SiteModules } from '~/interfaces/site'
import type { ParsedSiteSettings } from '../lib/types'

// Every field is optional and drops itself when invalid, so one bad value falls back alone (docs/api.md)
function lenient<T extends z.ZodType>(schema: T) {
  return schema.optional().catch(undefined)
}

const text = z.string().trim().min(1)
const httpUrl = text.regex(/^https?:\/\/\S+$/)

/** The shape of an IANA name (`Area/City`); the runtime alone would also accept offsets such as `+05:00`, which older browsers reject. */
const TIME_ZONE_NAME = /^[A-Za-z][A-Za-z0-9]*(?:[/_+-][A-Za-z0-9]+)*$/

/** Whether `value` is an IANA time zone name the runtime knows. */
function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
    return true
  } catch {
    // Not a time zone the runtime knows: the value is dropped and the default stays
    return false
  }
}

const email = text.refine(isValidEmail)

const image = z.object({
  url: text,
  alternativeText: z.string().nullish().transform(value => value || undefined),
  width: z.number().nullish().transform(value => value ?? undefined),
  height: z.number().nullish().transform(value => value ?? undefined),
})

const socialLink = z.object({ network: z.enum(SOCIAL_NETWORKS), url: httpUrl })

const modules = z.object(
  Object.fromEntries(SITE_MODULES.map(module => [module, lenient(z.boolean())])) as Record<keyof SiteModules, ReturnType<typeof lenient<z.ZodBoolean>>>,
)

const slug = z.string().regex(/^[a-z][a-z0-9-]*$/)
/** The `preferredUsername` the CMS accepts (micelio-cms `site.fediverse`). */
const FEDIVERSE_USERNAME = /^[a-z0-9_]+$/
const accentOverride = z.object({ mode: slug, color: z.string().regex(/^#[\da-f]{6}$/i) })

/** Strapi sends null for what was never set; each field drops itself when invalid. */
const theme = z.object({
  themeId: lenient(slug.nullish().transform(value => value ?? undefined)),
  defaultMode: lenient(slug.nullish().transform(value => value ?? undefined)),
  displayFont: lenient(z.enum(DISPLAY_FONTS).nullish().transform(value => value ?? undefined)),
  // Item by item: an invalid one is dropped, and the first valid one of a mode wins
  // At most 16 (a theme has at most 6 modes); a longer list is dropped whole
  accentOverrides: lenient(z.array(z.unknown()).max(16).transform((items) => {
    const seen = new Set<string>()
    return items.flatMap((item) => {
      const parsed = accentOverride.safeParse(item)
      if (!parsed.success || seen.has(parsed.data.mode)) return []
      seen.add(parsed.data.mode)
      return [parsed.data]
    })
  })),
})

/** The page Strapi chose for `/`; null when none, and only its slug is read. */
const homePage = z.object({ slug: z.string().regex(PAGE_SLUG_PATTERN) })

/**
 * The `site-setting` content of Strapi, validated field by field.
 *
 * @remarks
 * Every field is optional and falls back alone when it is invalid, so one bad value never drops the rest. `parseSiteSettings` is the only reader.
 */
export const siteSettingsSchema = z.object({
  name: lenient(text),
  description: lenient(text),
  url: lenient(httpUrl),
  defaultLocale: lenient(z.enum(Object.values(Locale) as [Locale, ...Locale[]])),
  author: lenient(z.object({ name: lenient(text), url: lenient(httpUrl) })),
  logo: lenient(image),
  favicon: lenient(image),
  defaultOgImage: lenient(image),
  socialLinks: lenient(z.array(z.unknown()).transform(links =>
    links.flatMap((link) => {
      const parsed = socialLink.safeParse(link)
      return parsed.success ? [parsed.data] : []
    }),
  )),
  contactEmail: lenient(email),
  privacyContactEmail: lenient(email),
  privacyUpdatedAt: lenient(z.iso.datetime({ offset: true })),
  privacyJurisdiction: lenient(z.enum(PRIVACY_JURISDICTIONS)),
  timezone: lenient(text.regex(TIME_ZONE_NAME).refine(isTimeZone)),
  supportHandle: lenient(text.regex(/^[A-Za-z0-9_-]+$/)),
  securityContact: lenient(z.string().transform(value => validSecurityContact(value)).pipe(z.string())),
  modules: lenient(modules),
  theme: lenient(theme),
  homePage: lenient(homePage.nullish().transform(value => value ?? undefined)),
  // The CMS's `fediverse` component, flattened to the one field the frontend reads
  fediverse: lenient(z.object({ username: lenient(z.string().regex(FEDIVERSE_USERNAME).max(30)) }).nullish()),
}).transform(({ fediverse, ...settings }) => ({ ...settings, ...(fediverse?.username && { fediverseUsername: fediverse.username }) }))

/** The site settings from a CMS body, or null when the body is not an object. */
export function parseSiteSettings(data: unknown): ParsedSiteSettings | null {
  const parsed = siteSettingsSchema.safeParse(data)
  return parsed.success ? parsed.data : null
}
