import { escapeXml } from '~/helpers/xml'
import qs from 'qs'
import { defaultLocale, Locale, type LocalePaths, type RawStrapiArticle } from '~/interfaces'
import { blogPath } from '~/helpers/blog'
import { localizedPath } from '~/helpers/locale'
import { isBlogEnabled } from '~/helpers/siteMode'
import { ARTICLE_HAS_SLUG } from '../lib/constants'
import type { LoadedCategory } from '../lib/types'
import { articlePaths, publishedTranslations } from '~/helpers/translations'

/** The categories with a published article, which are the ones the sitemap lists. A CMS failure lists none, so the articles still get their sitemap. */
async function sitemapCategories(): Promise<LoadedCategory[]> {
  try {
    return (await loadCategories(defaultLocale)).filter(category => category.count > 0)
  } catch (error: unknown) {
    logError('cms.categories', 'Listing the categories for the sitemap failed', { error })
    return []
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const siteUrl = config.public.siteUrl

  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200')

  try {
    const locales = Object.values(Locale)
    const responses = await Promise.all(locales.map((locale) => {
      const params = qs.stringify({
        locale,
        pagination: { pageSize: 1000 },
        fields: ['slug', 'locale', 'publishedAt', 'updatedAt'],
        populate: { localizations: { fields: ['slug', 'locale', 'publishedAt'] } },
        sort: 'publishedAt:desc',
        filters: ARTICLE_HAS_SLUG,
      })
      return strapiFetch<{ data: RawStrapiArticle[] }>(`/api/articles?${params}`)
    }))

    // A landing with no articles has no blog or about page to list (ADR 0006, section 1)
    const blogEnabled = isBlogEnabled(config.public.blogEnabled)
    // Slugs are not localized, so one locale gives the URLs of both
    const categories = blogEnabled ? await sitemapCategories() : []
    const staticPages = blogEnabled
      ? [
          { path: '/', changefreq: 'daily', priority: '1.0' },
          { path: '/blog', changefreq: 'daily', priority: '0.9' },
          ...categories.map(({ slug }) => ({ path: blogPath({ category: slug, page: 1 }), changefreq: 'daily', priority: '0.6' })),
          { path: '/about', changefreq: 'weekly', priority: '0.7' },
          { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
        ]
      : [
          { path: '/', changefreq: 'weekly', priority: '1.0' },
          { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
        ]

    const today = new Date().toISOString().slice(0, 10)

    const generateUrlEntry = (
      loc: string,
      alternates: LocalePaths,
      changefreq: string,
      priority: string,
      lastmod: string = today,
    ) => {
      const links = locales
        .filter(locale => alternates[locale])
        .map(locale => `<xhtml:link rel="alternate" hreflang="${locale}" href="${escapeXml(`${siteUrl}${alternates[locale]}`)}"/>`)
      const fallback = alternates[defaultLocale] ?? loc
      links.push(`<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(`${siteUrl}${fallback}`)}"/>`)

      return `<url>
    <loc>${escapeXml(`${siteUrl}${loc}`)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
    ${links.join('\n    ')}
  </url>`
    }

    const staticEntries = staticPages.flatMap((page) => {
      const alternates: LocalePaths = Object.fromEntries(locales.map(locale => [locale, localizedPath(page.path, locale)]))
      return locales.map(locale => generateUrlEntry(alternates[locale]!, alternates, page.changefreq, page.priority))
    })

    const postEntries = locales.flatMap((locale, index) =>
      (responses[index]?.data ?? []).map((post) => {
        const alternates = articlePaths(post.slug, locale, publishedTranslations(post.localizations))
        const lastmod = new Date(post.updatedAt || post.publishedAt || Date.now()).toISOString().slice(0, 10)
        return generateUrlEntry(alternates[locale]!, alternates, 'monthly', '0.8', lastmod)
      }),
    )

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  ${[...staticEntries, ...postEntries].join('\n  ')}
</urlset>`

    return sitemap
  } catch {
    throw problem('internalError', { message: 'Failed to generate sitemap' })
  }
})
