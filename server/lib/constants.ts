/** Headers an in-process (SSR) call carries so the real visitor survives the hop. Never leave the process. */
export const INTERNAL_IP_HEADER = 'x-micelio-internal-ip'
/** The header that carries the per-process nonce proving the internal IP header was set by this process. */
export const INTERNAL_NONCE_HEADER = 'x-micelio-internal-nonce'

/** The auth calls may send mail inside Strapi (register, password reset), so they wait longer than a read. */
export const AUTH_TIMEOUT_MS = 30_000

/** The fields of an image that a page reads; the rest of what the CMS stores about a file stays there. */
const IMAGE = { fields: ['url', 'alternativeText', 'caption', 'width', 'height'] }

/** The fields of a media file that a page section or a SEO image reads (`mime` tells a model from an image). */
const PAGE_MEDIA = { fields: ['url', 'alternativeText', 'width', 'height', 'mime'] }

/** The fields of an image of the site identity (logo, favicon, default social image). */
const SITE_IMAGE = { fields: ['url', 'alternativeText', 'width', 'height'] }

/**
 * The Strapi populate of a page.
 *
 * @remarks
 * Strapi does not mix '*' with keyed entries, so every relation of every section is named. Links and media are listed explicitly, and each media names its fields, so a new CMS field never widens the response.
 */
export const PAGE_POPULATE = {
  seo: { populate: { metaImage: PAGE_MEDIA } },
  localizations: { fields: ['slug', 'locale'] },
  sections: {
    on: {
      'section.hero': { populate: { primaryLink: true, secondaryLink: true, media: PAGE_MEDIA } },
      'section.feature-grid': { populate: { items: { populate: { icon: PAGE_MEDIA } } } },
      'section.media-showcase': { populate: { media: PAGE_MEDIA, link: true } },
      'section.stats': { populate: { items: true } },
      'section.logo-cloud': { populate: { logos: { populate: { image: PAGE_MEDIA } } } },
      'section.testimonials': { populate: { items: { populate: { avatar: PAGE_MEDIA } } } },
      'section.pricing': { populate: { plans: { populate: { link: true } } } },
      'section.faq': { populate: { items: true } },
      'section.cta': { populate: { primaryLink: true, secondaryLink: true } },
      'section.post-list': { populate: { category: { fields: ['slug'] }, tag: { fields: ['slug'] } } },
      'section.newsletter': { populate: '*' },
      'section.rich-text': { populate: '*' },
      'section.gallery': { populate: { images: PAGE_MEDIA } },
      'section.scene': { populate: { model: PAGE_MEDIA, poster: PAGE_MEDIA } },
    },
  },
}

/**
 * The Strapi populate of the site identity: one entry per relation or component `parseSiteSettings` reads.
 *
 * @remarks
 * Strapi does not mix '*' with keyed entries. `accentOverrides` sits inside `theme`, one level down, so `theme` needs its own populate.
 */
export const SITE_POPULATE = {
  author: { fields: ['name', 'url'] },
  logo: SITE_IMAGE,
  favicon: SITE_IMAGE,
  defaultOgImage: SITE_IMAGE,
  socialLinks: true,
  modules: true,
  theme: { populate: '*' },
  homePage: { fields: ['slug'] },
}

/** The Strapi populate of the RSS feed, which reads the cover URL and the category name. */
export const FEED_POPULATE = {
  cover: { fields: ['url'] },
  category: { fields: ['name'] },
}

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

/** Strapi filter that leaves out an article without a slug: the CMS `uid` is optional, and every route and link keys on the slug. */
export const ARTICLE_HAS_SLUG = { slug: { $notNull: true } }
