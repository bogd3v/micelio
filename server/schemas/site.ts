import { z } from 'zod'
import { isValidEmail } from '~/helpers/auth'
import { Locale } from '~/interfaces/locale'
import { SITE_MODULES, SOCIAL_NETWORKS } from '~/interfaces/site'
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
})

export function parseSiteSettings(data: unknown): SiteSettings | null {
  const parsed = siteSettingsSchema.safeParse(data)
  return parsed.success ? parsed.data : null
}
