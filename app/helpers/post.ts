import type { RawStrapiArticle, StrapiPost } from '../interfaces/strapi-post'
import { publishedTranslations } from './translations'

/**
 * Maps a raw Strapi article to the `StrapiPost` the pages use.
 *
 * @remarks
 * `seo` becomes `undefined` when it is `null` or missing, `blocks` and `references` become empty arrays when missing, and `localizations`
 * become the published `translations`. The blocks are not rendered here.
 */
export function toStrapiPost(article: RawStrapiArticle): StrapiPost {
  return {
    id: article.id,
    documentId: article.documentId,
    title: article.title,
    slug: article.slug,
    description: article.description,
    content: article.content,
    publishedAt: article.publishedAt,
    readTime: article.readTime,
    tags: article.tags,
    cover: article.cover,
    coverCredit: article.coverCredit,
    category: article.category,
    author: article.author,
    seo: article.seo ?? undefined,
    blocks: article.blocks ?? [],
    references: article.references ?? [],
    translations: publishedTranslations(article.localizations),
  }
}
