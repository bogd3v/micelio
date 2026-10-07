import { z } from 'zod'
import { Locale } from '~/interfaces/locale'
import type { Page, PageSection, PageSeo, PostListSection } from '~/interfaces'

/** Strapi uid shape: lowercase letters, digits and `-_.~`, starting with a letter or digit. */
export const PAGE_SLUG_PATTERN = /^[a-z0-9][a-z0-9_.~-]{0,63}$/
export const POST_LIST_MIN = 1
export const POST_LIST_MAX = 12
const POST_LIST_DEFAULT = 3

export const pageParamsSchema = z.object({
  slug: z.string({ error: 'Invalid slug' }).regex(PAGE_SLUG_PATTERN, 'Invalid slug'),
})

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
const linkUrl = text.regex(/^(?:https?:\/\/\S+|mailto:\S+|\/(?!\/)\S*)$/)
const httpUrl = text.regex(/^https?:\/\/\S+$/)
const mediaUrl = text.regex(/^(?:https?:\/\/\S+|\/(?!\/)\S*)$/)

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
  metaRobots: optional(text),
  keywords: optional(text),
  canonicalURL: optional(httpUrl),
})

function html(render: RenderMarkdown): z.ZodType<string> {
  return text.transform(render).refine(value => value.length > 0, 'Empty text')
}

function sectionSchemas(render: RenderMarkdown): Record<string, z.ZodType<PageSection>> {
  const markdown = html(render)
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
      model: media.refine(file => /\.(?:glb|gltf)(?:\?.*)?$/i.test(file.url), 'Not a glTF file'),
      poster: media,
      alt: text,
      title: optional(text),
      text: optional(text),
    }),
  }
  return schemas
}

/** One section, or null when its component is unknown or it fails its schema. */
export function parseSection(raw: unknown, render: RenderMarkdown): PageSection | null {
  return parseWith(raw, sectionSchemas(render))
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

const pageHeader = z.object({
  documentId: text,
  title: text,
  slug: z.string().regex(PAGE_SLUG_PATTERN),
  locale: optional(z.enum(Object.values(Locale) as [Locale, ...Locale[]])),
  seo: optional(seo),
  sections: z.array(z.unknown()).nullish(),
  localizations: z.array(z.unknown()).nullish(),
})

/**
 * Strapi's page, validated: an invalid or unknown section is dropped alone, never the page.
 * Null when the page itself has no title or slug.
 */
export function parsePage(data: unknown, render: RenderMarkdown): Page | null {
  const header = pageHeader.safeParse(data)
  if (!header.success) return null
  const { sections, localizations, seo: pageSeo, ...rest } = header.data
  const schemas = sectionSchemas(render)
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
