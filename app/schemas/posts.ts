import { z } from 'zod'
import type { CategoryCount } from '~/interfaces/design'
import type { ReadingPath, ReadingPathStep } from '~/interfaces/blog'
import type { PaginationMeta, StrapiPaginatedResponse } from '~/interfaces/strapi-response'
import type { DraftArticleResponse, PublishedVersion } from '~/interfaces/draft'
import type { PostListItem, RawStrapiArticle, SearchPostResult, StrapiAuthorRef, StrapiCategoryRef, StrapiLocalization, StrapiTagRef, TagCount } from '~/interfaces/strapi-post'
import type { StrapiReference } from '~/interfaces/strapi-reference'
import { categorySchema, imageCreditSchema, mediaRefSchema, seoSchema, strapiBlockSchema } from './blocks'
import { responseSchema } from './response'

/** A category with the number of posts in it (`GET /api/categories`). */
export const categoryCountSchema = responseSchema<CategoryCount>()(
  z.strictObject({ id: z.int(), slug: z.string().nullable(), name: z.string(), count: z.int().min(0) }).meta({ id: 'CategoryCount', description: 'A category with the number of posts in it.' }),
)

/** A tag with the number of its articles in one locale (`GET /api/tags`). */
export const tagCountSchema = responseSchema<TagCount>()(
  z.strictObject({ slug: z.string(), name: z.string(), count: z.int().min(1) }).meta({ id: 'TagCount', description: 'A tag with the number of its articles in the requested locale; tags with none are left out.' }),
)

/** The category of an article. */
const categoryRefSchema = responseSchema<StrapiCategoryRef>()(
  z.strictObject({ id: z.int().optional(), documentId: z.string().optional(), name: z.string().nullish(), slug: z.string().nullish() }).meta({ id: 'StrapiCategoryRef', description: 'The category of an article.' }),
)

/** A tag of an article. */
const tagRefSchema = responseSchema<StrapiTagRef>()(
  z.strictObject({ id: z.int().optional(), documentId: z.string().optional(), name: z.string(), slug: z.string() }).meta({ id: 'StrapiTagRef', description: 'A tag of an article, with its name and slug.' }),
)

/** The author of an article. */
const authorRefSchema = responseSchema<StrapiAuthorRef>()(
  z.strictObject({ id: z.int().optional(), documentId: z.string().optional(), name: z.string().nullish(), avatar: mediaRefSchema.nullish() }).meta({ id: 'StrapiAuthorRef', description: 'The author of an article, with an optional avatar.' }),
)

/** The same article in another locale. */
const localizationSchema = responseSchema<StrapiLocalization>()(
  z.strictObject({ id: z.int().optional(), documentId: z.string().optional(), slug: z.string(), locale: z.string(), publishedAt: z.string().nullish() }).meta({ id: 'StrapiLocalization', description: 'The version of an article in another locale.' }),
)

/** A reference of an article. */
const referenceSchema = responseSchema<StrapiReference>()(
  z.strictObject({
    id: z.int().optional(),
    key: z.string(),
    type: z.enum(['journal', 'conference', 'preprint', 'book', 'chapter', 'web', 'software', 'docs']),
    authors: z.string(),
    year: z.string(),
    title: z.string(),
    container: z.string().nullish(),
    volume: z.string().nullish(),
    issue: z.string().nullish(),
    pages: z.string().nullish(),
    venueLabel: z.string().nullish(),
    doi: z.string().nullish(),
    url: z.string().nullish(),
    accessedAt: z.string().nullish(),
  }).meta({ id: 'StrapiReference', description: 'A bibliographic reference an article cites by `key`.' }),
)

/**
 * An article, whole (`GET /api/posts/{slug}`) or as a card (`GET /api/posts`).
 *
 * @remarks
 * `content` and `createdAt` are never sent: `publicArticle` and `publicPostCard` leave them out.
 */
export const articleSchema = responseSchema<RawStrapiArticle>()(
  z.strictObject({
    id: z.int(),
    documentId: z.string(),
    title: z.string().nullable(),
    slug: z.string(),
    description: z.string().nullish(),
    content: z.string().nullish().meta({ description: 'Never sent: the legacy Markdown body that `blocks` replaced.', deprecated: true }),
    publishedAt: z.string().nullish(),
    updatedAt: z.string().nullish(),
    createdAt: z.string().nullish().meta({ description: 'Never sent: the allow-list leaves it out.' }),
    locale: z.string().nullish(),
    readTime: z.number().nullish(),
    tags: z.array(tagRefSchema).nullish(),
    cover: mediaRefSchema.nullish(),
    coverCredit: imageCreditSchema.nullish(),
    category: categoryRefSchema.nullish(),
    author: authorRefSchema.nullish(),
    seo: seoSchema.nullish(),
    snippet: z.string().nullish(),
    blocks: z.array(strapiBlockSchema).nullish(),
    references: z.array(referenceSchema).nullish(),
    localizations: z.array(localizationSchema).nullish(),
  }).meta({ id: 'RawStrapiArticle', description: 'An article as the route sends it: a card has no blocks, references or localizations, a whole article has no `snippet`.' }),
)

/**
 * A post card of a `post-list` section.
 *
 * @remarks
 * The page route reduces each card with the allow-list of `GET /api/posts` (`publicPostCard`, `cardShape`), so the keys here are
 * the ones of `cardShape`; `test/pagesResponse.test.ts` parses a card built by `publicPostCard`.
 */
export const postListItemSchema = responseSchema<PostListItem>()(
  z.strictObject({
    id: z.int(),
    documentId: z.string().optional(),
    title: z.string().nullable(),
    slug: z.string(),
    locale: z.string().nullish(),
    description: z.string().nullish(),
    publishedAt: z.string().nullish(),
    readTime: z.number().nullish(),
    tags: z.array(tagRefSchema).nullish(),
    cover: mediaRefSchema.nullish(),
    category: categoryRefSchema.nullish(),
    author: authorRefSchema.nullish(),
    seo: seoSchema.nullish(),
    snippet: z.string().nullish(),
  }).meta({ id: 'PostListItem', description: 'An article card of a post list section.' }),
)

/** The pagination of a list answer. */
export const paginationMetaSchema = responseSchema<PaginationMeta>()(
  z.strictObject({ page: z.int().min(1), pageSize: z.int().min(0), pageCount: z.int().min(0), total: z.int().min(0) }).meta({ id: 'PaginationMeta', description: 'The current page (from 1), the page size, the number of pages and the total.' }),
)

/** A page of articles (`GET /api/posts`). */
export const articlePageSchema = responseSchema<StrapiPaginatedResponse<RawStrapiArticle[]>>()(
  z.strictObject({ data: z.array(articleSchema), meta: z.strictObject({ pagination: paginationMetaSchema }) }).meta({ id: 'ArticlePage', description: 'A page of articles and its pagination.' }),
)

/** One hit of the search (`GET /api/search`). */
export const searchResultSchema = responseSchema<SearchPostResult>()(
  z.strictObject({
    documentId: z.string(),
    title: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    publishedAt: z.string().nullable(),
    category: z.strictObject({ name: z.string().nullable(), slug: z.string().nullable() }).nullable(),
    matchedIn: z.enum(['title', 'description', 'content']),
    snippet: z.string(),
  }).meta({ id: 'SearchPostResult', description: 'An article that matched, the field that matched and an excerpt around the match (empty when there is none).' }),
)

/** A step of a reading path. */
const readingPathStepSchema = responseSchema<ReadingPathStep>()(
  z.strictObject({ documentId: z.string(), slug: z.string(), title: z.string().nullable() }).meta({ id: 'ReadingPathStep', description: 'An article of a reading path.' }),
)

/** The reading path of a category (`GET /api/reading-path`). */
export const readingPathSchema = responseSchema<ReadingPath>()(
  z.strictObject({ category: categorySchema, editorial: z.boolean(), steps: z.array(readingPathStepSchema) }).meta({ id: 'ReadingPath', description: 'Up to 50 articles of a category in reading order; `editorial` is false when they follow the publication date.' }),
)

/**
 * The published version of a draft.
 *
 * @internal Exported for the tests.
 */
export const publishedVersionSchema = responseSchema<PublishedVersion>()(
  z.strictObject({ slug: z.string(), updatedAt: z.string().nullable(), publishedAt: z.string().nullable() }).meta({ id: 'PublishedVersion', description: 'The published version of a draft: its slug and its dates.' }),
)

/** A draft and its published version (`GET /api/drafts/{documentId}`). */
export const draftArticleResponseSchema = responseSchema<DraftArticleResponse>()(
  z.strictObject({ article: articleSchema, published: publishedVersionSchema.nullable().meta({ description: 'Null when the article has no published version.' }) }).meta({ id: 'DraftArticleResponse', description: 'A draft for the preview page, with its published version when it has one.' }),
)
