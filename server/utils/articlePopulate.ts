/** What a post card needs; shared by the blog list and the page sections */
export const POST_CARD_POPULATE = {
  cover: { populate: '*' },
  category: { populate: '*' },
  author: { populate: '*' },
  seo: { populate: '*' },
  tags: { fields: ['name', 'slug'] },
}

export const ARTICLE_POPULATE = {
  cover: { populate: '*' },
  coverCredit: true,
  category: { populate: '*' },
  author: { populate: '*' },
  seo: { populate: '*' },
  tags: { fields: ['name', 'slug'] },
  blocks: {
    on: {
      'shared.rich-text': { populate: '*' },
      'shared.quote': { populate: '*' },
      'shared.media': { populate: { file: true, credit: true } },
      'shared.slider': { populate: { items: { populate: { file: true, credit: true } }, files: true } },
    },
  },
  references: true,
  localizations: { fields: ['slug', 'locale', 'publishedAt'] },
}
