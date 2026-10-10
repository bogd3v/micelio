import { z } from 'zod'
import { Locale } from '~/interfaces/locale'
import type { Page, PageSection, PageSeo, PostListSection } from '~/interfaces'

import { PAGE_SLUG_PATTERN } from '~/constants/pages'
import { isGlbUrl } from '~/helpers/scene'

/** Fewest posts a `section.post-list` shows: its `count` is clamped up to this. */
export const POST_LIST_MIN = 1
/** Most posts a `section.post-list` shows: its `count` is clamped down to this. */
export const POST_LIST_MAX = 12
const POST_LIST_DEFAULT = 3

/** The route parameters of `GET /api/pages/:slug`: a `slug` that matches `PAGE_SLUG_PATTERN`, checked before any CMS call. A slug that fails it is a 400 `Invalid slug`. */
export const pageParamsSchema = z.object({
  slug: z.string({ error: 'Invalid slug' }).regex(PAGE_SLUG_PATTERN, 'Invalid slug'),
})

/** Renders Markdown from the CMS to HTML for a text section. The renderer of `markdownRenderer` sanitizes its output. */
export type RenderMarkdown = (markdown: string) => string

// Strapi sends null (or '') for what was never set; an invalid optional value drops itself alone
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess(value => (value === null || value === '' ? undefined : value), schema.optional()).catch(undefined) as z.ZodType<z.output<T> | undefined>
}

function variant<const V extends readonly [string, ...string[]]>(values: V) {
  return z.preprocess(value => value ?? undefined, z.enum(values).default(values[0]))
}

/** Items one by one: an invalid one is dropped, and a list with none left is invalid. */
function list<T extends z.ZodType>(schema: T) {
  return z.array(z.unknown()).transform(entries =>
    entries.flatMap((entry) => {
      const parsed = schema.safeParse(entry)
      return parsed.success ? [parsed.data as z.output<T>] : []
    }),
  ).refine(entries => entries.length > 0, 'Empty list')
}

const text = z.string().trim().min(1)
// One leading slash and no backslash: `//host` and `/\host` both leave the site in a browser
const SITE_PATH = String.raw`\/(?![\/\\])[^\s\\]*`
const sitePath = new RegExp(`^${SITE_PATH}$`)
const linkUrl = text.regex(new RegExp(String.raw`^(?:https?:\/\/\S+|mailto:\S+|${SITE_PATH})$`))
const httpUrl = text.regex(/^https?:\/\/\S+$/)

// The directives of the robots meta tag that Google documents
const ROBOTS_TOKEN = /^(?:all|none|index|noindex|follow|nofollow|noarchive|nosnippet|noimageindex|notranslate|max-image-preview:(?:none|standard|large)|max-snippet:-?\d+|max-video-preview:-?\d+)$/

function originOf(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/** What the schemas need besides the data: the Markdown renderer and the origins the site trusts. */
export interface PageContext {
  render: RenderMarkdown
  /** The site's public URL; a canonical URL must be on its origin */
  siteUrl?: string
  /** Origins media may come from (the CSP `img-src` ones); site paths only under /uploads/ */
  mediaOrigins: string[]
}

function sharedSchemas(context: PageContext) {
  const siteOrigin = context.siteUrl ? originOf(context.siteUrl) : null
  const mediaOrigins = new Set(context.mediaOrigins.flatMap(url => originOf(url) ?? []))

  // Site paths only under /uploads/ (Strapi local uploads), without `..`; the frontend applies the same rule
  const mediaUrl = text.refine(url => (sitePath.test(url) && url.startsWith('/uploads/') && !url.includes('..')) || (httpUrl.safeParse(url).success && mediaOrigins.has(originOf(url) ?? '')))

  const media = z.object({
    url: mediaUrl,
    alternativeText: optional(z.string().trim()),
    width: optional(z.number().positive()),
    height: optional(z.number().positive()),
    mime: optional(z.string()),
  })

  const link = z.object({ label: text, url: linkUrl })

  const seo = z.object({
    metaTitle: text,
    metaDescription: text,
    metaImage: optional(media),
    metaRobots: optional(text.refine(value => value.split(',').every(token => ROBOTS_TOKEN.test(token.trim().toLowerCase())))),
    keywords: optional(text),
    canonicalURL: optional(httpUrl.refine(url => siteOrigin !== null && originOf(url) === siteOrigin)),
  })

  return { media, link, seo }
}

function html(render: RenderMarkdown): z.ZodType<string> {
  return text.transform(render).refine(value => value.length > 0, 'Empty text')
}

function sectionSchemas(context: PageContext, { media, link }: ReturnType<typeof sharedSchemas>): Record<string, z.ZodType<PageSection>> {
  const markdown = html(context.render)
  const slugRelation = optional(z.object({ slug: text }).transform(relation => relation.slug))

  const schemas: Record<string, z.ZodType<PageSection>> = {
    'section.hero': z.object({
      __component: z.literal('section.hero'),
      variant: variant(['centered', 'split', 'full-bleed']),
      title: text,
      text: optional(text),
      primaryLink: optional(link),
      secondaryLink: optional(link),
      media: optional(media),
    }),
    'section.feature-grid': z.object({
      __component: z.literal('section.feature-grid'),
      variant: variant(['grid', 'list', 'bento']),
      title: optional(text),
      text: optional(text),
      items: list(z.object({ icon: optional(media), title: text, text: optional(text) })),
    }),
    'section.media-showcase': z.object({
      __component: z.literal('section.media-showcase'),
      variant: variant(['left', 'right', 'stacked']),
      title: optional(text),
      text: optional(markdown),
      media,
      link: optional(link),
    }).transform(({ text: rendered, ...rest }) => ({ ...rest, ...(rendered && { html: rendered }) })),
    'section.stats': z.object({
      __component: z.literal('section.stats'),
      variant: variant(['row', 'cards']),
      title: optional(text),
      items: list(z.object({ value: text, label: text })),
    }),
    'section.logo-cloud': z.object({
      __component: z.literal('section.logo-cloud'),
      variant: variant(['row', 'marquee']),
      title: optional(text),
      logos: list(z.object({ image: media, name: text, url: optional(httpUrl) })),
    }),
    'section.testimonials': z.object({
      __component: z.literal('section.testimonials'),
      variant: variant(['single', 'grid']),
      title: optional(text),
      items: list(z.object({ quote: text, author: text, role: optional(text), avatar: optional(media) })),
    }),
    'section.pricing': z.object({
      __component: z.literal('section.pricing'),
      variant: variant(['cards', 'table']),
      title: optional(text),
      text: optional(text),
      plans: list(z.object({
        name: text,
        price: text,
        period: optional(text),
        features: optional(z.string()).transform(features => (features ?? '').split('\n').map(line => line.trim()).filter(Boolean)),
        link: optional(link),
        recommended: z.boolean().catch(false),
      })),
    }),
    'section.faq': z.object({
      __component: z.literal('section.faq'),
      variant: variant(['list', 'two-columns']),
      title: optional(text),
      items: list(z.object({ question: text, answer: markdown }).transform(({ question, answer }) => ({ question, html: answer }))),
    }),
    'section.cta': z.object({
      __component: z.literal('section.cta'),
      variant: variant(['banner', 'card']),
      title: text,
      text: optional(text),
      primaryLink: optional(link),
      secondaryLink: optional(link),
    }),
    'section.post-list': z.object({
      __component: z.literal('section.post-list'),
      variant: variant(['cards', 'list']),
      title: optional(text),
      category: slugRelation,
      tag: slugRelation,
      count: z.number().catch(POST_LIST_DEFAULT).transform(count => Math.min(POST_LIST_MAX, Math.max(POST_LIST_MIN, Math.trunc(count)))),
    }).transform((section): PostListSection => {
      // The CMS refuses both; if one gets through, the category wins
      const { tag, ...rest } = section
      return { ...rest, ...(section.category ? {} : { tag }), posts: [] }
    }),
    'section.newsletter': z.object({
      __component: z.literal('section.newsletter'),
      variant: variant(['inline', 'card']),
      title: optional(text),
      text: optional(text),
      buttonLabel: optional(text),
    }),
    'section.rich-text': z.object({
      __component: z.literal('section.rich-text'),
      body: markdown,
    }).transform(({ __component, body }) => ({ __component, html: body })),
    'section.gallery': z.object({
      __component: z.literal('section.gallery'),
      variant: variant(['grid', 'masonry']),
      title: optional(text),
      images: list(media),
    }),
    'section.scene': z.object({
      __component: z.literal('section.scene'),
      variant: variant(['background', 'inline']),
      // Binary glTF only: a .gltf names external buffers the island would not fetch (ADR 0006, amendment of #246)
      model: media.refine(file => isGlbUrl(file.url), 'Not a .glb file'),
      poster: media,
      alt: text,
      title: optional(text),
      text: optional(text),
    }),
  }
  return schemas
}

/** One section, or null when its component is unknown or it fails its schema. */
export function parseSection(raw: unknown, context: PageContext): PageSection | null {
  return parseWith(raw, sectionSchemas(context, sharedSchemas(context)))
}

function parseWith(raw: unknown, schemas: Record<string, z.ZodType<PageSection>>): PageSection | null {
  const component = raw && typeof raw === 'object' ? (raw as { __component?: unknown }).__component : undefined
  if (typeof component !== 'string') return null
  const schema = Object.hasOwn(schemas, component) ? schemas[component] : undefined
  if (!schema) return null
  const parsed = schema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

const translation = z.object({
  slug: z.string().regex(PAGE_SLUG_PATTERN),
  locale: z.enum(Object.values(Locale) as [Locale, ...Locale[]]),
})

function pageHeader(seo: ReturnType<typeof sharedSchemas>['seo']) {
  return z.object({
    documentId: text,
    title: text,
    slug: z.string().regex(PAGE_SLUG_PATTERN),
    locale: optional(z.enum(Object.values(Locale) as [Locale, ...Locale[]])),
    seo: optional(seo),
    sections: z.array(z.unknown()).nullish(),
    localizations: z.array(z.unknown()).nullish(),
  })
}

/**
 * Strapi's page, validated: an invalid or unknown section is dropped alone, never the page.
 * Null when the page itself has no title or slug.
 */
export function parsePage(data: unknown, context: PageContext): Page | null {
  const shared = sharedSchemas(context)
  const header = pageHeader(shared.seo).safeParse(data)
  if (!header.success) return null
  const { sections, localizations, seo: pageSeo, ...rest } = header.data
  const schemas = sectionSchemas(context, shared)
  return {
    ...rest,
    ...(pageSeo && { seo: pageSeo as PageSeo }),
    sections: (sections ?? []).flatMap((section) => {
      const parsed = parseWith(section, schemas)
      return parsed ? [parsed] : []
    }),
    translations: (localizations ?? []).flatMap((entry) => {
      const parsed = translation.safeParse(entry)
      return parsed.success ? [parsed.data] : []
    }),
  }
}
