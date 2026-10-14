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

/**
 * The Strapi populate of the About page: every block of the dynamic zone with the nested components and images it renders.
 *
 * @remarks
 * Strapi 5 drops what a fragment does not name, so a nested component or an image needs its own entry here; the scalars of a
 * component always come with it. Keep it in step with `aboutBlocks` in `server/lib/publicShapes.ts`, which limits what leaves the server.
 */
export const ABOUT_POPULATE = {
  blocks: {
    on: {
      'about.profile': { populate: { facts: true, links: true, photo: IMAGE } },
      'about.statement': true,
      'about.topics': { populate: { topics: true } },
      'about.projects': { populate: { projects: { populate: { facts: true, stack: true, links: true } } } },
      'about.principles': { populate: { principles: true } },
      'about.open-source': { populate: { guide: true } },
      'about.contact': { populate: { fediverseLink: true, extraLink: true, socials: true } },
      'shared.rich-text': true,
      'shared.quote': true,
      'shared.media': { populate: { file: IMAGE, credit: true } },
      'shared.slider': { populate: { items: { populate: { file: IMAGE, credit: true } }, files: IMAGE } },
    },
  },
  seo: { populate: { metaImage: IMAGE } },
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
