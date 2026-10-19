import { z } from 'zod'
import { Locale } from '~/interfaces/locale'
import { DISPLAY_FONTS, PRIVACY_JURISDICTIONS, SOCIAL_NETWORKS } from '~/interfaces/site'
import type { AccentColors, Site, SiteAuthor, SiteImage, SiteModules, SiteTheme, SocialLink } from '~/interfaces/site'
import { responseSchema } from './response'

// A zod enum over a TypeScript enum yields the union of its members, which the exact-type tie reads as a different type, so `defaultLocale` is cast to `Locale` (the runtime check is unchanged)
const LOCALES = Object.values(Locale) as [Locale, ...Locale[]]

/** An image of the site; `alternativeText`, `width` and `height` are absent when Strapi gives none. */
export const siteImageSchema = responseSchema<SiteImage>()(
  z.strictObject({
    url: z.string(),
    alternativeText: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  }).meta({ id: 'SiteImage', description: 'An image of the site. `url` is absolute when `NUXT_PUBLIC_STRAPI_URL` is set, or a path on the site for the favicon of the configuration or the theme.' }),
)

/** A link to one social network of the site. */
export const socialLinkSchema = responseSchema<SocialLink>()(
  z.strictObject({ network: z.enum(SOCIAL_NETWORKS), url: z.string() }).meta({ id: 'SocialLink', description: 'A link to one social network or profile of the site.' }),
)

/** The author of the site. */
export const siteAuthorSchema = responseSchema<SiteAuthor>()(
  z.strictObject({ name: z.string(), url: z.string() }).meta({ id: 'SiteAuthor', description: 'The author of the site: a name and the address of their page.' }),
)

/** Whether each optional module is on, after the server switched off the ones it cannot serve. */
export const siteModulesSchema = responseSchema<SiteModules>()(
  z.strictObject({
    newsletter: z.boolean(),
    comments: z.boolean(),
    accounts: z.boolean(),
    drafts: z.boolean(),
    fediverse: z.boolean(),
    search: z.boolean(),
    support: z.boolean(),
  }).meta({ id: 'SiteModules', description: 'Whether each optional module is on, after the server switched off the ones it cannot serve (a missing SMTP or fediverse setting, the site mode).' }),
)

const hexColor = z.string().regex(/^#[\da-f]{6}$/)

/** The accent family of one mode. */
export const accentColorsSchema = responseSchema<AccentColors>()(
  z.strictObject({ accent: hexColor, accentSoft: hexColor, accentHover: hexColor, onAccent: hexColor }).meta({ id: 'AccentColors', description: 'The accent family of one mode, as `#rrggbb` after the contrast correction.' }),
)

/** The theme overrides that apply to the built theme. */
export const siteThemeSchema = responseSchema<SiteTheme>()(
  z.strictObject({
    id: z.string(),
    defaultMode: z.string().optional(),
    displayFont: z.enum(DISPLAY_FONTS).optional(),
    accents: z.record(z.string(), accentColorsSchema),
  }).meta({ id: 'SiteTheme', description: 'What the CMS theme settings came to after checking them against the built theme (ADR 0005, section 8). `accents` is by mode id and holds only the modes whose accent differs from the theme\'s.' }),
)

/** The site identity every page reads. */
export const siteSchema = responseSchema<Site>()(
  z.strictObject({
    name: z.string(),
    description: z.string(),
    url: z.string(),
    defaultLocale: z.enum(LOCALES) as z.ZodType<Locale>,
    author: siteAuthorSchema,
    logo: siteImageSchema.nullable(),
    favicon: siteImageSchema.nullable(),
    defaultOgImage: siteImageSchema.nullable(),
    socialLinks: z.array(socialLinkSchema),
    contactEmail: z.string(),
    privacyContactEmail: z.string(),
    privacyUpdatedAt: z.string(),
    privacyJurisdiction: z.enum([...PRIVACY_JURISDICTIONS, '']),
    supportHandle: z.string(),
    modules: siteModulesSchema,
    theme: siteThemeSchema.optional(),
    homePage: z.strictObject({ slug: z.string() }).meta({ id: 'SiteHomePage', description: 'The page shown at `/` in this locale.' }).optional(),
  }).meta({ id: 'Site', description: 'The site identity, its modules and, when overrides apply, its theme. Empty strings mean unset. `theme` and `homePage` are absent when they do not apply.' }),
)
