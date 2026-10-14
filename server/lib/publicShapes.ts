import { allow, each, fields, variants } from '~/helpers/allowList'
import type { Shape } from '~/helpers/allowList'
import type { PostListItem, RawStrapiArticle, StrapiAbout } from '~/interfaces'

// The fields of each CMS answer that may leave the server (ASVS V15.3.1). They follow the interfaces in `app/interfaces/`: a field the pages
// do not read, like the hash, size or provider of a file, a folder or a share override, is not here, and neither is one the CMS adds later.

const media = fields({ id: true, documentId: true, url: true, alternativeText: true, caption: true, width: true, height: true })
const credit = fields({ id: true, kind: true, author: true, authorUrl: true, source: true, sourceUrl: true, license: true, licenseUrl: true, modifications: true })
const category = fields({ id: true, documentId: true, name: true, slug: true })
const tag = fields({ id: true, documentId: true, name: true, slug: true })
const author = fields({ id: true, documentId: true, name: true, avatar: media })
const seoImage = fields({ url: true, alternativeText: true, data: fields({ attributes: fields({ url: true, alternativeText: true, width: true, height: true }) }) })
const seo = fields({ id: true, metaTitle: true, metaDescription: true, metaImage: seoImage, keywords: true, metaRobots: true, structuredData: true, canonicalURL: true })
const reference = fields({ id: true, key: true, type: true, authors: true, year: true, title: true, container: true, volume: true, issue: true, pages: true, venueLabel: true, doi: true, url: true, accessedAt: true })
const localization = fields({ id: true, documentId: true, slug: true, locale: true, publishedAt: true })

const sharedBlocks = {
  'shared.rich-text': fields({ id: true, __component: true, body: true, html: true }),
  'shared.quote': fields({ id: true, __component: true, body: true, html: true, title: true }),
  'shared.media': fields({ id: true, __component: true, file: media, caption: true, credit }),
  'shared.slider': fields({ id: true, __component: true, items: each(fields({ id: true, file: media, caption: true, credit })), files: each(media) }),
}

const fact = fields({ id: true, label: true, value: true, mono: true })
const link = fields({ id: true, label: true, url: true, variant: true })
const item = fields({ id: true, title: true, text: true, html: true })
const aboutBlocks = {
  'about.profile': fields({ id: true, __component: true, eyebrow: true, title: true, lead: true, facts: each(fact), links: each(link), photo: media, plateLabel: true, plateCoordinates: true, caption: true }),
  'about.statement': fields({ id: true, __component: true, eyebrow: true, statement: true, body: true }),
  'about.topics': fields({ id: true, __component: true, eyebrow: true, title: true, intro: true, topics: each(fields({ id: true, category: true, title: true, description: true })), footnoteLabel: true, footnote: true }),
  'about.projects': fields({
    id: true,
    __component: true,
    anchor: true,
    eyebrow: true,
    title: true,
    intro: true,
    projects: each(fields({
      id: true,
      eyebrow: true,
      meta: true,
      title: true,
      description: true,
      facts: each(fact),
      stack: each(fields({ id: true, name: true })),
      links: each(link),
      featured: true,
      visual: true,
      visualCaption: true,
    })),
  }),
  'about.principles': fields({ id: true, __component: true, eyebrow: true, title: true, principles: each(item) }),
  'about.open-source': fields({ id: true, __component: true, eyebrow: true, text: true, code: true, guideTitle: true, guide: each(item) }),
  'about.contact': fields({
    id: true,
    __component: true,
    eyebrow: true,
    title: true,
    fediverseLabel: true,
    fediverseHandle: true,
    fediverseLink: link,
    extraLink: link,
    socials: each(fields({ id: true, network: true, handle: true, url: true })),
  }),
}

const cardFields = { id: true, documentId: true, title: true, slug: true, locale: true, description: true, publishedAt: true, readTime: true, tags: each(tag), cover: media, category, author, seo, snippet: true } as const

const articleShape: Shape = fields({
  ...cardFields,
  content: true,
  // The draft strip shows when the draft was last edited
  updatedAt: true,
  coverCredit: credit,
  blocks: each(variants('__component', { ...sharedBlocks, 'shared.playground': fields({ id: true, __component: true, runtime: true, code: true, expectedOutput: true, setup: true, caption: true }) })),
  references: each(reference),
  localizations: each(localization),
})
const cardShape: Shape = fields(cardFields)
const aboutShape: Shape = fields({ id: true, documentId: true, title: true, locale: true, seo, blocks: each(variants('__component', { ...sharedBlocks, ...aboutBlocks })) })

/** A full article as the CMS sent it, reduced to the fields the article page reads. */
export function publicArticle(article: RawStrapiArticle): RawStrapiArticle {
  return allow(article, articleShape) as RawStrapiArticle
}

/** An article of a list, reduced to the fields a card reads. */
export function publicPostCard(article: RawStrapiArticle): PostListItem {
  return allow(article, cardShape) as PostListItem
}

/** The About page as the CMS sent it, reduced to the fields its blocks render. */
export function publicAbout(about: StrapiAbout): StrapiAbout {
  return allow(about, aboutShape) as StrapiAbout
}
