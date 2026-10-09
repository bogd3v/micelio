import { z } from 'zod'
import { isValidEmail } from '~/helpers/auth'
import { Locale } from '~/interfaces/locale'
import { PAGE_SLUG_PATTERN } from '~/constants/pages'
import { DISPLAY_FONTS, SITE_MODULES, SOCIAL_NETWORKS } from '~/interfaces/site'
import type { SiteModules, SiteSettings } from '~/interfaces/site'

// Every field is optional and drops itself when invalid, so one bad value falls back alone (docs/api.md)
function lenient<T extends z.ZodType>(schema: T) {
  return schema.optional().catch(undefined)
}

const text = z.string().trim().min(1)
const httpUrl = text.regex(/^https?:\/\/\S+$/)
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
  supportHandle: lenient(text.regex(/^[A-Za-z0-9_-]+$/)),
  modules: lenient(modules),
  theme: lenient(theme),
  homePage: lenient(homePage.nullish().transform(value => value ?? undefined)),
})

export function parseSiteSettings(data: unknown): SiteSettings | null {
  const parsed = siteSettingsSchema.safeParse(data)
  return parsed.success ? parsed.data : null
}
