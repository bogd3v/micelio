/** Headers an in-process (SSR) call carries so the real visitor survives the hop. Never leave the process. */
export const INTERNAL_IP_HEADER = 'x-micelio-internal-ip'
/** The header that carries the per-process nonce proving the internal IP header was set by this process. */
export const INTERNAL_NONCE_HEADER = 'x-micelio-internal-nonce'

/** The auth calls may send mail inside Strapi (register, password reset), so they wait longer than a read. */
export const AUTH_TIMEOUT_MS = 30_000

/** The fields of an image that a page reads; the rest of what the CMS stores about a file stays there. */
const IMAGE = { fields: ['url', 'alternativeText', 'caption', 'width', 'height'] }

/** The Strapi populate of a post card; shared by the blog list and the page sections. */
export const POST_CARD_POPULATE = {
  cover: IMAGE,
  category: { fields: ['name', 'slug'] },
  author: { fields: ['name'], populate: { avatar: IMAGE } },
  seo: { populate: { metaImage: IMAGE } },
  tags: { fields: ['name', 'slug'] },
}

/** The Strapi populate of a full article, with every block of the dynamic zone. */
export const ARTICLE_POPULATE = {
  cover: IMAGE,
  coverCredit: true,
  category: { fields: ['name', 'slug'] },
  author: { fields: ['name'], populate: { avatar: IMAGE } },
  seo: { populate: { metaImage: IMAGE } },
  tags: { fields: ['name', 'slug'] },
  blocks: {
    on: {
      'shared.rich-text': true,
      'shared.quote': true,
      'shared.media': { populate: { file: IMAGE, credit: true } },
      'shared.playground': true,
      'shared.slider': { populate: { items: { populate: { file: IMAGE, credit: true } }, files: IMAGE } },
    },
  },
  references: true,
  localizations: { fields: ['slug', 'locale', 'publishedAt'] },
}
