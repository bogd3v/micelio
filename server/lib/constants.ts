/** Headers an in-process (SSR) call carries so the real visitor survives the hop. Never leave the process. */
export const INTERNAL_IP_HEADER = 'x-micelio-internal-ip'
/** The header that carries the per-process nonce proving the internal IP header was set by this process. */
export const INTERNAL_NONCE_HEADER = 'x-micelio-internal-nonce'

/** The most categories one read of the CMS list returns (one page); the server list and the static build both stop here. */
export const MAX_CATEGORIES = 100

/** The auth calls may send mail inside Strapi (register, password reset), so they wait longer than a read. */
export const AUTH_TIMEOUT_MS = 30_000

/** The fields of an image that a page reads; the rest of what the CMS stores about a file stays there. */
const IMAGE = { fields: ['url', 'alternativeText', 'caption', 'width', 'height'] }

/** The fields of a media file that a page section or a SEO image reads (`mime` tells a model from an image). */
const PAGE_MEDIA = { fields: ['url', 'alternativeText', 'width', 'height', 'mime'] }

/** The fields of an image of the site identity (logo, favicon, default social image). */
const SITE_IMAGE = { fields: ['url', 'alternativeText', 'width', 'height'] }

/** The group key of a block in a page's zone (ADR 0022, section 2): a component with `groupId` and `tone`. */
const GROUP = { group: true } as const

/** The nested links, media and relations of each block of the catalogue, without the `group` key. */
const HERO = { primaryLink: true, secondaryLink: true, media: PAGE_MEDIA }
const FEATURE_GRID = { items: { populate: { icon: PAGE_MEDIA } } }
const MEDIA_SHOWCASE = { media: PAGE_MEDIA, link: true }
const ITEMS = { items: true }
const LOGO_CLOUD = { logos: { populate: { image: PAGE_MEDIA } } }
const TESTIMONIALS = { items: { populate: { avatar: PAGE_MEDIA, logo: PAGE_MEDIA } } }
const PRICING = { plans: { populate: { link: true } } }
const CTA = { primaryLink: true, secondaryLink: true }
const POST_LIST = { category: { fields: ['slug'] }, tag: { fields: ['slug'] } }
const GALLERY = { images: PAGE_MEDIA }
const SCENE = { model: PAGE_MEDIA, poster: PAGE_MEDIA }

/**
 * The fragments of a reusable block's `blocks` zone (ADR 0022, section 1): the blocks of the catalogue a page's zone has, each without its `group` key.
 *
 * @remarks
 * It leaves out `section.rich-text`, which the CMS keeps in a page's zone only and the plugin's catalogue lacks, so the reusable block's zone refuses it with `400`; `section.reusable`, since a target is never a reference (one level); and `group`, which the reference holds (the plugin refuses a reusable block's block with one, `reusableBlockInvalid`).
 */
const REUSABLE_BLOCK_FRAGMENTS = {
  'section.hero': { populate: HERO },
  'section.feature-grid': { populate: FEATURE_GRID },
  'section.media-showcase': { populate: MEDIA_SHOWCASE },
  'section.stats': { populate: ITEMS },
  'section.logo-cloud': { populate: LOGO_CLOUD },
  'section.testimonials': { populate: TESTIMONIALS },
  'section.pricing': { populate: PRICING },
  'section.faq': { populate: ITEMS },
  'section.cta': { populate: CTA },
  'section.post-list': { populate: POST_LIST },
  'section.newsletter': true,
  'shared.rich-text': true,
  'section.gallery': { populate: GALLERY },
  'section.scene': { populate: SCENE },
}

/**
 * The Strapi populate of a page.
 *
 * @remarks
 * Strapi does not mix '*' with keyed entries, so every relation of every section is named. Links and media are listed explicitly, and each media names its fields, so a new CMS field never widens the response.
 * It names both text components, `section.rich-text` and `shared.rich-text` (`prose`): a fragment populate returns only the components it names, and the CMS keeps `section.rich-text` in the zone for one release.
 * Each block that may be a member of a group asks for its `group` key, and `section.reusable` for its `group` and the document id of the reusable block it references (ADR 0022): the target is read apart, published and in the page's locale (`readReusableTargets`, `server/utils/reusableTargets.ts`). A CMS without these components (`micelio-cms` before 0.10) answers `400`.
 */
export const PAGE_POPULATE = {
  seo: { populate: { metaImage: PAGE_MEDIA } },
  localizations: { fields: ['slug', 'locale'] },
  sections: {
    on: {
      'section.hero': { populate: { ...HERO, ...GROUP } },
      'section.feature-grid': { populate: { ...FEATURE_GRID, ...GROUP } },
      'section.media-showcase': { populate: { ...MEDIA_SHOWCASE, ...GROUP } },
      'section.stats': { populate: { ...ITEMS, ...GROUP } },
      'section.logo-cloud': { populate: { ...LOGO_CLOUD, ...GROUP } },
      'section.testimonials': { populate: { ...TESTIMONIALS, ...GROUP } },
      'section.pricing': { populate: { ...PRICING, ...GROUP } },
      'section.faq': { populate: { ...ITEMS, ...GROUP } },
      'section.cta': { populate: { ...CTA, ...GROUP } },
      'section.post-list': { populate: { ...POST_LIST, ...GROUP } },
      'section.newsletter': { populate: GROUP },
      'section.rich-text': { populate: '*' },
      'shared.rich-text': true,
      'section.gallery': { populate: { ...GALLERY, ...GROUP } },
      'section.scene': { populate: { ...SCENE, ...GROUP } },
      'section.reusable': { populate: { ...GROUP, reusableBlock: { fields: ['documentId'] } } },
    },
  },
}

/**
 * The Strapi populate of a page draft: that of a page.
 *
 * @remarks
 * It names only components of the `sections` zone of the page (`shared.rich-text` since micelio-cms #502, `section.reusable` since micelio-cms #527): the plugin refuses with `400` a fragment populate that names a component the zone lacks. `shared.playground` is not in that zone, so a Playground block of a page is not asked for until the CMS adds it (bogd3v/micelio#908).
 */
export const DRAFT_PAGE_POPULATE = PAGE_POPULATE

/**
 * The Strapi populate of the published reusable blocks a page references, read with one filtered `GET /api/reusable-blocks` (ADR 0022, section 1): their `blocks` zone, with the fragments of `REUSABLE_BLOCK_FRAGMENTS`.
 *
 * @see `readReusableTargets` in `server/utils/reusableTargets.ts`
 */
export const REUSABLE_BLOCK_POPULATE = {
  blocks: { on: REUSABLE_BLOCK_FRAGMENTS },
}

/**
 * The Strapi populate of a page read by a system grant bound to a reference (ADR 0019, amendment of 2026-11-23): that of a page, but the reference's entry reaches the reusable block it points at, with its `blocks` zone.
 *
 * @remarks
 * Only the weight route sends it, and only on a request marked `measure=reference`: the plugin refuses with `400` a `populate` that reaches the reusable block for any other grant, and only a CMS whose pages have `section.reusable` mints that grant. Its `section.reusable` entry replaces the page's: the reference's `group`, and the block's zone with `REUSABLE_BLOCK_FRAGMENTS`.
 */
export const REFERENCE_PAGE_POPULATE = {
  ...PAGE_POPULATE,
  sections: {
    on: {
      ...PAGE_POPULATE.sections.on,
      'section.reusable': { populate: { ...GROUP, reusableBlock: { populate: { blocks: { on: REUSABLE_BLOCK_FRAGMENTS } } } } },
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
  fediverse: { fields: ['username'] },
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

/** The `@layer` order of `app/assets/css/main.css`; Lightning CSS drops the statement when it bundles, so the head carries it inline before any stylesheet (ADR 0009, section 6). */
export const LAYER_ORDER = '@layer myc.reset,myc.settings,myc.base,myc.components,myc.layout,myc.pages,myc.theme,myc.animations,myc.utilities;'
