import { z } from 'zod'
import { SLUG_PATTERN } from '~/constants/slug'
import type {
  StrapiBlock,
  StrapiContact,
  StrapiContactLink,
  StrapiFact,
  StrapiImageCredit,
  StrapiItem,
  StrapiLink,
  StrapiMedia,
  StrapiMediaFile,
  StrapiOpenSource,
  StrapiPlayground,
  StrapiPrinciples,
  StrapiProfile,
  StrapiProject,
  StrapiProjects,
  StrapiQuote,
  StrapiRichText,
  StrapiSlide,
  StrapiSlider,
  StrapiStatement,
  StrapiTechItem,
  StrapiTopic,
  StrapiTopics,
} from '~/interfaces/strapi-blocks'
import type { StrapiAbout } from '~/interfaces/strapi-about'
import type { StrapiMediaRef } from '~/interfaces/strapi-post'
import type { StrapiMetaSocial, StrapiSEO } from '~/interfaces/strapi-seo'
import { responseSchema } from './response'

// Everything an article carries besides its own fields: images, SEO and the dynamic-zone blocks, with the About sections the block union includes.
// The routes rebuild each one from the allow-lists of `publicShapes` (server/lib/publicShapes.ts), so objects are strict

/** An upload as a block, a slide or a slider file carries it. */
const mediaFileSchema = responseSchema<StrapiMediaFile>()(
  z.strictObject({
    id: z.int().optional(),
    documentId: z.string().optional(),
    url: z.string(),
    alternativeText: z.string().nullish(),
    caption: z.string().nullish(),
    width: z.int().nullish(),
    height: z.int().nullish(),
  }).meta({ id: 'StrapiMediaFile', description: 'An upload of a block, a slide or a slider: a `/uploads/` path or an absolute URL, with its text and size when the CMS has them.' }),
)

/** An image of an article or an author. */
export const mediaRefSchema = responseSchema<StrapiMediaRef>()(
  z.strictObject({
    id: z.int().optional(),
    documentId: z.string().optional(),
    url: z.string(),
    alternativeText: z.string().nullish(),
    caption: z.string().nullish(),
    width: z.int().nullish(),
    height: z.int().nullish(),
  }).meta({ id: 'StrapiMediaRef', description: 'An image of an article or an author: a `/uploads/` path or an absolute URL, with its text and size when the CMS has them.' }),
)

/** The credit line of an image. */
export const imageCreditSchema = responseSchema<StrapiImageCredit>()(
  z.strictObject({
    id: z.int().optional(),
    kind: z.enum(['photo', 'illustration', 'diagram', 'screenshot']),
    author: z.string().nullish(),
    authorUrl: z.string().nullish(),
    source: z.string().nullish(),
    sourceUrl: z.string().nullish(),
    license: z.enum(['own-work', 'cc0', 'public-domain', 'cc-by-4.0', 'cc-by-sa-4.0', 'cc-by-nc-4.0', 'unsplash', 'permission', 'other']),
    licenseUrl: z.string().nullish(),
    modifications: z.string().nullish(),
  }).meta({ id: 'StrapiImageCredit', description: 'Who made an image, where it comes from and under which licence.' }),
)

/** A share override of the SEO component; the allow-list of `publicShapes` drops it, so the route never sends one. */
const metaSocialSchema = responseSchema<StrapiMetaSocial>()(
  z.strictObject({
    id: z.int(),
    socialNetwork: z.enum(['Facebook', 'Twitter']),
    title: z.string(),
    description: z.string(),
    image: z.strictObject({ data: z.strictObject({ attributes: z.strictObject({ url: z.string(), alternativeText: z.string().nullish() }) }) }).optional(),
  }).meta({ id: 'StrapiMetaSocial', description: 'A social share override of the SEO component. The route does not send it.' }),
)

/** The SEO component of an entry. */
export const seoSchema = responseSchema<StrapiSEO>()(
  z.strictObject({
    id: z.int(),
    metaTitle: z.string(),
    metaDescription: z.string(),
    metaImage: z.strictObject({
      url: z.string().optional(),
      alternativeText: z.string().nullish(),
      data: z.strictObject({
        attributes: z.strictObject({ url: z.string(), alternativeText: z.string().nullish(), width: z.int().optional(), height: z.int().optional() }),
      }).optional(),
    }).nullish(),
    metaSocial: z.array(metaSocialSchema).optional().meta({ description: 'Never sent: the allow-list leaves it out.' }),
    keywords: z.string().nullish(),
    metaRobots: z.string().nullish(),
    // JSON-LD passes through as the editors wrote it: an object, an array of objects, or null when empty
    structuredData: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]).nullish(),
    metaViewport: z.string().nullish().meta({ description: 'Never sent: the allow-list leaves it out.' }),
    canonicalURL: z.string().nullish(),
  }).meta({ id: 'StrapiSEO', description: 'The SEO component of an entry: titles, share image, robots and optional JSON-LD.' }),
)

/** The slug of a category: any slug of the CMS, checked by shape only (ADR 0016, section 7). */
const categorySlugSchema = z.string().regex(SLUG_PATTERN)

// The About sections: the route rebuilds each one from the allow-list of `aboutBlocks` (server/lib/publicShapes.ts), so every object is strict

/** A label and value pair of a profile or a project. */
const factSchema = responseSchema<StrapiFact>()(
  z.strictObject({ id: z.int(), label: z.string(), value: z.string(), mono: z.boolean().nullish() }).meta({ id: 'StrapiFact', description: 'A label and value pair, shown as a definition list item.' }),
)

/** A link button of an About section. */
const linkSchema = responseSchema<StrapiLink>()(
  z.strictObject({ id: z.int(), label: z.string(), url: z.string(), variant: z.enum(['primary', 'secondary', 'text']) }).meta({ id: 'StrapiLink', description: 'A link button: an absolute URL or a path, and its style.' }),
)

/** A principle, or a step of the open source guide. */
const itemSchema = responseSchema<StrapiItem>()(
  z.strictObject({ id: z.int(), title: z.string().nullish(), text: z.string(), html: z.string().optional() }).meta({ id: 'StrapiItem', description: 'A principle or a guide step; `html` is the rendered `text` of a guide step.' }),
)

/** A topic with the category it belongs to. */
const topicSchema = responseSchema<StrapiTopic>()(
  z.strictObject({ id: z.int(), category: categorySlugSchema, title: z.string(), description: z.string().nullish() }).meta({ id: 'StrapiTopic', description: 'A topic card and the slug of the category that sets its colour.' }),
)

/** A technology in the stack of a project. */
const techItemSchema = responseSchema<StrapiTechItem>()(
  z.strictObject({ id: z.int(), name: z.string() }).meta({ id: 'StrapiTechItem', description: 'A technology of a project stack.' }),
)

/** A project card. */
const projectSchema = responseSchema<StrapiProject>()(
  z.strictObject({
    id: z.int(),
    eyebrow: z.string().nullish(),
    meta: z.string().nullish(),
    title: z.string(),
    description: z.string().nullish(),
    facts: z.array(factSchema).optional(),
    stack: z.array(techItemSchema).optional(),
    links: z.array(linkSchema).optional(),
    featured: z.boolean().nullish(),
    visual: z.enum(['none', 'fediverse', 'palette']),
    visualCaption: z.string().nullish(),
  }).meta({ id: 'StrapiProject', description: 'A project card of the projects section.' }),
)

/** A social profile of the contact section. */
const contactLinkSchema = responseSchema<StrapiContactLink>()(
  z.strictObject({ id: z.int(), network: z.string(), handle: z.string(), url: z.string() }).meta({ id: 'StrapiContactLink', description: 'A social account: its network, handle and URL.' }),
)

/** The profile section (`about.profile`). */
const profileSchema = responseSchema<StrapiProfile>()(
  z.strictObject({
    id: z.int(),
    __component: z.literal('about.profile'),
    eyebrow: z.string().nullish(),
    title: z.string(),
    lead: z.string().nullish(),
    facts: z.array(factSchema).optional(),
    links: z.array(linkSchema).optional(),
    photo: mediaFileSchema.nullish(),
    plateLabel: z.string().nullish(),
    plateCoordinates: z.string().nullish(),
    caption: z.string().nullish(),
  }).meta({ id: 'AboutProfile', description: 'The profile section: a title, a lead, facts and a photo on a plate.' }),
)

/** The statement section (`about.statement`). */
const statementSchema = responseSchema<StrapiStatement>()(
  z.strictObject({ id: z.int(), __component: z.literal('about.statement'), eyebrow: z.string().nullish(), statement: z.string(), body: z.string().nullish() }).meta({ id: 'AboutStatement', description: 'A statement with an optional body text.' }),
)

/** The topics section (`about.topics`). */
const topicsSchema = responseSchema<StrapiTopics>()(
  z.strictObject({
    id: z.int(),
    __component: z.literal('about.topics'),
    eyebrow: z.string().nullish(),
    title: z.string().nullish(),
    intro: z.string().nullish(),
    topics: z.array(topicSchema).optional(),
    footnoteLabel: z.string().nullish(),
    footnote: z.string().nullish(),
  }).meta({ id: 'AboutTopics', description: 'One card per topic, with an optional footnote.' }),
)

/** The projects section (`about.projects`). */
const projectsSchema = responseSchema<StrapiProjects>()(
  z.strictObject({
    id: z.int(),
    __component: z.literal('about.projects'),
    anchor: z.string().nullish(),
    eyebrow: z.string().nullish(),
    title: z.string().nullish(),
    intro: z.string().nullish(),
    projects: z.array(projectSchema).optional(),
  }).meta({ id: 'AboutProjects', description: 'The project cards.' }),
)

/** The principles section (`about.principles`). */
const principlesSchema = responseSchema<StrapiPrinciples>()(
  z.strictObject({ id: z.int(), __component: z.literal('about.principles'), eyebrow: z.string().nullish(), title: z.string().nullish(), principles: z.array(itemSchema).optional() }).meta({ id: 'AboutPrinciples', description: 'A numbered list of principles.' }),
)

/** The open source section (`about.open-source`). */
const openSourceSchema = responseSchema<StrapiOpenSource>()(
  z.strictObject({
    id: z.int(),
    __component: z.literal('about.open-source'),
    eyebrow: z.string().nullish(),
    text: z.string().nullish(),
    code: z.string().nullish(),
    guideTitle: z.string().nullish(),
    guide: z.array(itemSchema).optional(),
  }).meta({ id: 'AboutOpenSource', description: 'A text, a shell command and a guide.' }),
)

/** The contact section (`about.contact`). */
const contactSchema = responseSchema<StrapiContact>()(
  z.strictObject({
    id: z.int(),
    __component: z.literal('about.contact'),
    eyebrow: z.string().nullish(),
    title: z.string().nullish(),
    fediverseLabel: z.string().nullish(),
    fediverseHandle: z.string().nullish(),
    fediverseLink: linkSchema.nullish(),
    extraLink: linkSchema.nullish(),
    socials: z.array(contactLinkSchema).optional(),
  }).meta({ id: 'AboutContact', description: 'A fediverse handle and links.' }),
)

// Every block is rebuilt from the allow-lists of `publicShapes` (server/lib/publicShapes.ts), so objects are strict. The server drops a block with an unknown `__component`, so the union is closed

/** A Markdown text block (`shared.rich-text`). */
const richTextSchema = responseSchema<StrapiRichText>()(
  z.strictObject({ id: z.int(), __component: z.literal('shared.rich-text'), body: z.string().nullable(), html: z.string().optional() }).meta({ id: 'RichTextBlock', description: 'Markdown as stored, and its sanitized HTML.' }),
)

/** A quote block (`shared.quote`). */
const quoteSchema = responseSchema<StrapiQuote>()(
  z.strictObject({ id: z.int(), __component: z.literal('shared.quote'), body: z.string().nullable(), html: z.string().optional(), title: z.string().nullish() }).meta({ id: 'QuoteBlock', description: 'A quote in Markdown, its inline HTML and the attribution.' }),
)

/** An image block (`shared.media`). */
const mediaBlockSchema = responseSchema<StrapiMedia>()(
  z.strictObject({ id: z.int(), __component: z.literal('shared.media'), file: mediaFileSchema.nullable(), caption: z.string().nullish(), credit: imageCreditSchema.nullish() }).meta({ id: 'MediaBlock', description: 'An image with its caption and credit.' }),
)

/** A playground block (`shared.playground`). */
const playgroundSchema = responseSchema<StrapiPlayground>()(
  z.strictObject({
    id: z.int(),
    __component: z.literal('shared.playground'),
    runtime: z.string(),
    code: z.string(),
    expectedOutput: z.string().nullish(),
    setup: z.string().nullish(),
    caption: z.string().nullish(),
  }).meta({ id: 'PlaygroundBlock', description: 'Code with its runtime and expected output; `python`, `sql` and `javascript` can run.' }),
)

/** One slide of a slider. */
const slideSchema = responseSchema<StrapiSlide>()(
  z.strictObject({ id: z.int().optional(), file: mediaFileSchema, caption: z.string().nullish(), credit: imageCreditSchema.nullish() }).meta({ id: 'StrapiSlide', description: 'A slide with its own caption and credit.' }),
)

/** A slider block (`shared.slider`). */
const sliderSchema = responseSchema<StrapiSlider>()(
  z.strictObject({ id: z.int(), __component: z.literal('shared.slider'), items: z.array(slideSchema).nullish(), files: z.array(mediaFileSchema).nullish() }).meta({ id: 'SliderBlock', description: 'Slides, or plain uploads when there are none.' }),
)

/**
 * Any block of a dynamic zone, by `__component`.
 *
 * @remarks
 * An article carries the `shared.*` ones only, but `RawStrapiArticle.blocks` is typed with the whole `StrapiBlock` union, so the article schema accepts the `about.*` ones too.
 */
export const strapiBlockSchema = responseSchema<StrapiBlock>()(
  z.discriminatedUnion('__component', [
    richTextSchema,
    quoteSchema,
    mediaBlockSchema,
    playgroundSchema,
    sliderSchema,
    profileSchema,
    statementSchema,
    topicsSchema,
    projectsSchema,
    principlesSchema,
    openSourceSchema,
    contactSchema,
  ]).meta({ id: 'StrapiBlock', description: 'A block of a dynamic zone, discriminated by `__component`.' }),
)

/**
 * The About page (`GET /api/about`).
 *
 * @remarks
 * Rebuilt from the allow-list `aboutShape`, so unknown keys are rejected. The CMS sends `title: null` for an untitled page and `seo: null` for an empty SEO component.
 */
export const aboutSchema = responseSchema<StrapiAbout>()(
  z.strictObject({
    id: z.int(),
    documentId: z.string(),
    title: z.string().nullable(),
    locale: z.string(),
    seo: seoSchema.nullish(),
    blocks: z.array(strapiBlockSchema),
  }).meta({ id: 'StrapiAbout', description: 'The About page with its blocks, Markdown already rendered to sanitized HTML.' }),
)
