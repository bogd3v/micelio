import qs from 'qs'
import type { H3Event } from 'h3'
import type { Category, Locale, RawStrapiArticle } from '~/interfaces'
import { isCategory } from '~/helpers/categories'
import { feedPath } from '~/helpers/feed'
import en from '../../i18n/locales/en.json'
import es from '../../i18n/locales/es.json'

export type FeedLocale = 'en' | 'es'

export interface FeedOptions {
  locale: FeedLocale
  category?: Category
}

const MESSAGES = { en, es } as const
const FEED_SIZE = 50

function localePrefix(locale: FeedLocale): string {
  return locale === 'es' ? '/es' : ''
}

function otherLocale(locale: FeedLocale): FeedLocale {
  return locale === 'es' ? 'en' : 'es'
}

function cdata(value: string): string {
  return `<![CDATA[${value.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function categoryMessage(message: string, siteName: string, locale: FeedLocale, category: Category): string {
  return message.replace('{site}', siteName).replace('{category}', MESSAGES[locale].bd.categories[category])
}

function channelTitle(siteName: string, locale: FeedLocale, category?: Category): string {
  if (!category) return `${siteName} - Personal Blog${locale === 'es' ? ' (Español)' : ''}`
  return categoryMessage(MESSAGES[locale].feed.categoryTitle, siteName, locale, category)
}

function channelDescription(siteName: string, locale: FeedLocale, category?: Category): string {
  if (!category) return 'Exploring AI, Software Development, Linux, and more. A personal space for thoughts, tutorials, and experiments from Bogotá, Colombia.'
  return categoryMessage(MESSAGES[locale].feed.categoryDescription, siteName, locale, category)
}

async function fetchFeedPosts({ locale, category }: FeedOptions): Promise<RawStrapiArticle[]> {
  const params = qs.stringify({
    pagination: { pageSize: FEED_SIZE },
    populate: ['cover', 'category', 'author'],
    sort: 'publishedAt:desc',
    locale,
    ...(category ? { filters: { category: { slug: { $eq: category } } } } : {}),
  })
  const response = await strapiFetch<{ data: RawStrapiArticle[] }>(`/api/articles?${params}`)
  return response.data || []
}

export async function renderFeed(options: FeedOptions): Promise<string> {
  const { locale, category } = options
  const config = useRuntimeConfig()
  const baseUrl = config.public.siteUrl
  const [posts, { site }] = await Promise.all([fetchFeedPosts(options), loadSite(locale as Locale)])

  const feedUrl = `${baseUrl}${feedPath(locale, category)}`
  const altFeedUrl = `${baseUrl}${feedPath(otherLocale(locale), category)}`
  const channelLink = category
    ? `${baseUrl}${localePrefix(locale)}/blog?category=${category}`
    : `${baseUrl}${localePrefix(locale)}`
  const title = escapeXml(channelTitle(site.name, locale, category))
  const description = escapeXml(channelDescription(site.name, locale, category))

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <channel>
    <title>${title}</title>
    <description>${description}</description>
    <link>${channelLink}</link>
    <language>${locale === 'es' ? 'es-co' : 'en-us'}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>
    <atom:link href="${altFeedUrl}" rel="alternate" type="application/rss+xml" hreflang="${otherLocale(locale)}"/>
    <generator>${escapeXml(site.name)}</generator>
    ${posts
      .map((post) => {
        const coverUrl = post.cover?.url
          ? post.cover.url.startsWith('http')
            ? post.cover.url
            : strapiUrl(post.cover.url)
          : ''
        const pubDate = post.publishedAt
          ? new Date(post.publishedAt).toUTCString()
          : new Date().toUTCString()
        const itemDescription = post.description || ''

        const itemLocale = post.locale || 'en'
        const postUrl = `${baseUrl}${itemLocale === 'es' ? '/es' : ''}/blog/${post.slug}`
        const altPostUrl = `${baseUrl}${itemLocale === 'es' ? '' : '/es'}/blog/${post.slug}`
        return `<item>
      <title>${cdata(post.title)}</title>
      <description>${cdata(itemDescription)}</description>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <dc:language>${itemLocale}</dc:language>
      <xhtml:link rel="alternate" hreflang="${itemLocale}" href="${postUrl}"/>
      <xhtml:link rel="alternate" hreflang="${itemLocale === 'es' ? 'en' : 'es'}" href="${altPostUrl}"/>
      ${post.category?.name ? `<category>${cdata(post.category.name)}</category>` : ''}
      ${coverUrl ? `<enclosure url="${coverUrl}" type="image/jpeg"/>` : ''}
    </item>`
      })
      .join('\n')}
  </channel>
</rss>`
}

export async function sendFeed(event: H3Event, options: FeedOptions): Promise<string> {
  setHeader(event, 'Content-Type', 'application/rss+xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600')
  try {
    return await renderFeed(options)
  } catch {
    throw createError({ statusCode: 500, message: 'Failed to generate RSS feed' })
  }
}

export function feedCategory(file: string | undefined): Category {
  const match = /^([a-z-]+)\.xml$/.exec(file ?? '')
  const slug = match?.[1]
  if (!slug || !isCategory(slug)) {
    throw createError({ statusCode: 404, message: 'Feed not found' })
  }
  return slug
}
