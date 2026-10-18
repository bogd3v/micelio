import { z } from 'zod'
import { Locale } from '~/interfaces/locale'
import type {
  CtaSection,
  FaqItem,
  FaqSection,
  FeatureGridSection,
  FeatureItem,
  GallerySection,
  HeroSection,
  LogoCloudSection,
  LogoItem,
  MediaShowcaseSection,
  NewsletterSection,
  Page,
  PageLink,
  PageMedia,
  PageSection,
  PageSeo,
  PostListSection,
  PricingPlan,
  PricingSection,
  RichTextSection,
  SceneSection,
  StatItem,
  StatsSection,
  TestimonialItem,
  TestimonialsSection,
} from '~/interfaces/page'
import type { PostTranslation } from '~/interfaces/strapi-post'
import { postListItemSchema } from './posts'
import { responseSchema } from './response'

// What `GET /api/pages/{slug}` sends: the output of `parsePage` (server/schemas/page.ts), which rebuilds the page key by key, so every object is strict.
// A section the server dropped is simply absent; `variant` is always present because the server fills the default.

// A zod enum over a TypeScript enum yields the union of its members, which the exact-type tie reads as a different type (see `siteSchema`)
const LOCALES = Object.values(Locale) as [Locale, ...Locale[]]
const localeSchema = z.enum(LOCALES) as z.ZodType<Locale>

/** An image, a video or a 3D model file of a page section. */
export const pageMediaSchema = responseSchema<PageMedia>()(
  z.strictObject({
    url: z.string().meta({ description: 'A `/uploads/` path, or an http(s) URL on the CMS or a configured media origin.' }),
    alternativeText: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    mime: z.string().optional(),
  }).meta({ id: 'PageMedia', description: 'An image, a video or a 3D model file of a page section, validated by the server.' }),
)

/** A link of a page section. */
export const pageLinkSchema = responseSchema<PageLink>()(
  z.strictObject({ label: z.string(), url: z.string().meta({ description: 'An http(s) or `mailto:` URL, or a path on the site.' }) }).meta({ id: 'PageLink', description: 'A link of a page section, to another page or to an external address.' }),
)

/** The search and share metadata of a page. */
export const pageSeoSchema = responseSchema<PageSeo>()(
  z.strictObject({
    metaTitle: z.string(),
    metaDescription: z.string(),
    metaImage: pageMediaSchema.optional(),
    metaRobots: z.string().optional(),
    keywords: z.string().optional(),
    canonicalURL: z.string().optional().meta({ description: 'An absolute http(s) URL on the site\'s own origin.' }),
  }).meta({ id: 'PageSeo', description: 'The search and share metadata of a page, validated by the server.' }),
)

/** The other locale of a page, for hreflang. */
export const pageTranslationSchema = responseSchema<PostTranslation>()(
  z.strictObject({ locale: localeSchema, slug: z.string() }).meta({ id: 'PageTranslation', description: 'The same page in another locale.' }),
)

const heroSchema = responseSchema<HeroSection>()(
  z.strictObject({
    __component: z.literal('section.hero'),
    variant: z.enum(['centered', 'split', 'full-bleed']),
    title: z.string(),
    text: z.string().optional(),
    primaryLink: pageLinkSchema.optional(),
    secondaryLink: pageLinkSchema.optional(),
    media: pageMediaSchema.optional(),
  }).meta({ id: 'HeroSection', description: 'The opening section of a page: a title, an optional text, up to two links and a media.' }),
)

const featureItemSchema = responseSchema<FeatureItem>()(
  z.strictObject({ icon: pageMediaSchema.optional(), title: z.string(), text: z.string().optional() }).meta({ id: 'FeatureItem', description: 'One feature of a feature grid.' }),
)

const featureGridSchema = responseSchema<FeatureGridSection>()(
  z.strictObject({
    __component: z.literal('section.feature-grid'),
    variant: z.enum(['grid', 'list', 'bento']),
    title: z.string().optional(),
    text: z.string().optional(),
    items: z.array(featureItemSchema),
  }).meta({ id: 'FeatureGridSection', description: 'A grid, a list or a bento layout of features.' }),
)

const mediaShowcaseSchema = responseSchema<MediaShowcaseSection>()(
  z.strictObject({
    __component: z.literal('section.media-showcase'),
    variant: z.enum(['left', 'right', 'stacked']),
    title: z.string().optional(),
    html: z.string().optional().meta({ description: 'Sanitized HTML of the Markdown text.' }),
    media: pageMediaSchema,
    link: pageLinkSchema.optional(),
  }).meta({ id: 'MediaShowcaseSection', description: 'A media file with a text beside it.' }),
)

const statItemSchema = responseSchema<StatItem>()(
  z.strictObject({ value: z.string().meta({ description: 'Shown as written, so `12k` or `99%` need no conversion.' }), label: z.string() }).meta({ id: 'StatItem', description: 'One figure of a stats section.' }),
)

const statsSchema = responseSchema<StatsSection>()(
  z.strictObject({
    __component: z.literal('section.stats'),
    variant: z.enum(['row', 'cards']),
    title: z.string().optional(),
    items: z.array(statItemSchema),
  }).meta({ id: 'StatsSection', description: 'A row or a set of cards of figures.' }),
)

const logoItemSchema = responseSchema<LogoItem>()(
  z.strictObject({ image: pageMediaSchema, name: z.string(), url: z.string().optional().meta({ description: 'http(s) only.' }) }).meta({ id: 'LogoItem', description: 'One logo of a logo cloud.' }),
)

const logoCloudSchema = responseSchema<LogoCloudSection>()(
  z.strictObject({
    __component: z.literal('section.logo-cloud'),
    variant: z.enum(['row', 'marquee']),
    title: z.string().optional(),
    logos: z.array(logoItemSchema),
  }).meta({ id: 'LogoCloudSection', description: 'A row or a moving strip of logos.' }),
)

const testimonialItemSchema = responseSchema<TestimonialItem>()(
  z.strictObject({ quote: z.string().meta({ description: 'Plain text, not Markdown.' }), author: z.string(), role: z.string().optional(), avatar: pageMediaSchema.optional() }).meta({ id: 'TestimonialItem', description: 'One quote of a testimonials section.' }),
)

const testimonialsSchema = responseSchema<TestimonialsSection>()(
  z.strictObject({
    __component: z.literal('section.testimonials'),
    variant: z.enum(['single', 'grid']),
    title: z.string().optional(),
    items: z.array(testimonialItemSchema),
  }).meta({ id: 'TestimonialsSection', description: 'One quote or a grid of quotes.' }),
)

const pricingPlanSchema = responseSchema<PricingPlan>()(
  z.strictObject({
    name: z.string(),
    price: z.string(),
    period: z.string().optional(),
    features: z.array(z.string()).meta({ description: 'One feature per line of the CMS text; empty when it has none.' }),
    link: pageLinkSchema.optional(),
    recommended: z.boolean(),
  }).meta({ id: 'PricingPlan', description: 'One plan of a pricing section.' }),
)

const pricingSchema = responseSchema<PricingSection>()(
  z.strictObject({
    __component: z.literal('section.pricing'),
    variant: z.enum(['cards', 'table']),
    title: z.string().optional(),
    text: z.string().optional(),
    plans: z.array(pricingPlanSchema),
  }).meta({ id: 'PricingSection', description: 'Plans as cards or as a comparison table.' }),
)

const faqItemSchema = responseSchema<FaqItem>()(
  z.strictObject({ question: z.string(), html: z.string().meta({ description: 'Sanitized HTML of the Markdown answer.' }) }).meta({ id: 'FaqItem', description: 'One question of a FAQ section.' }),
)

const faqSchema = responseSchema<FaqSection>()(
  z.strictObject({
    __component: z.literal('section.faq'),
    variant: z.enum(['list', 'two-columns']),
    title: z.string().optional(),
    items: z.array(faqItemSchema),
  }).meta({ id: 'FaqSection', description: 'A list of questions and answers.' }),
)

const ctaSchema = responseSchema<CtaSection>()(
  z.strictObject({
    __component: z.literal('section.cta'),
    variant: z.enum(['banner', 'card']),
    title: z.string(),
    text: z.string().optional(),
    primaryLink: pageLinkSchema.optional(),
    secondaryLink: pageLinkSchema.optional(),
  }).meta({ id: 'CtaSection', description: 'A call to action with up to two links.' }),
)

const postListSchema = responseSchema<PostListSection>()(
  z.strictObject({
    __component: z.literal('section.post-list'),
    variant: z.enum(['cards', 'list']),
    title: z.string().optional(),
    category: z.string().optional().meta({ description: 'Category slug the list is filtered by; never sent together with `tag`.' }),
    tag: z.string().optional(),
    count: z.int().min(1).max(12),
    posts: z.array(postListItemSchema).meta({ description: 'The newest published posts, resolved on the server for the first four post lists of a page; empty for the others.' }),
  }).meta({ id: 'PostListSection', description: 'A list of the newest published posts, optionally filtered by a category or a tag.' }),
)

const newsletterSchema = responseSchema<NewsletterSection>()(
  z.strictObject({
    __component: z.literal('section.newsletter'),
    variant: z.enum(['inline', 'card']),
    title: z.string().optional(),
    text: z.string().optional(),
    buttonLabel: z.string().optional(),
  }).meta({ id: 'NewsletterSection', description: 'The newsletter sign-up form.' }),
)

const richTextSchema = responseSchema<RichTextSection>()(
  z.strictObject({
    __component: z.literal('section.rich-text'),
    html: z.string().meta({ description: 'Sanitized HTML of the Markdown body.' }),
  }).meta({ id: 'RichTextSection', description: 'A text block written in Markdown.' }),
)

const gallerySchema = responseSchema<GallerySection>()(
  z.strictObject({
    __component: z.literal('section.gallery'),
    variant: z.enum(['grid', 'masonry']),
    title: z.string().optional(),
    images: z.array(pageMediaSchema),
  }).meta({ id: 'GallerySection', description: 'A grid or a masonry of images.' }),
)

const sceneSchema = responseSchema<SceneSection>()(
  z.strictObject({
    __component: z.literal('section.scene'),
    variant: z.enum(['background', 'inline']),
    model: pageMediaSchema.meta({ description: 'A binary glTF file (`.glb`); with any other file the server drops the section.' }),
    poster: pageMediaSchema,
    alt: z.string(),
    title: z.string().optional(),
    text: z.string().optional(),
  }).meta({ id: 'SceneSection', description: 'A 3D model with a poster image, shown as a background or inline.' }),
)

/** Any section of a page, by `__component`; one schema per member of `PAGE_SECTION_COMPONENTS`. */
export const pageSectionSchema = responseSchema<PageSection>()(
  z.discriminatedUnion('__component', [
    heroSchema,
    featureGridSchema,
    mediaShowcaseSchema,
    statsSchema,
    logoCloudSchema,
    testimonialsSchema,
    pricingSchema,
    faqSchema,
    ctaSchema,
    postListSchema,
    newsletterSchema,
    richTextSchema,
    gallerySchema,
    sceneSchema,
  ]).meta({ id: 'PageSection', description: 'Any section of a page, discriminated by `__component`.' }),
)

/** A page built from sections (`GET /api/pages/{slug}`). */
export const pageSchema = responseSchema<Page>()(
  z.strictObject({
    documentId: z.string().meta({ description: 'Strapi\'s document id.' }),
    title: z.string(),
    slug: z.string(),
    locale: localeSchema.optional(),
    seo: pageSeoSchema.optional(),
    sections: z.array(pageSectionSchema).meta({ description: 'The sections that passed validation, in order; an invalid or unknown one is left out.' }),
    translations: z.array(pageTranslationSchema),
  }).meta({ id: 'Page', description: 'A page as the server returns it after validation.' }),
)
