import { describe, expect, it } from 'vitest'
import { articlePath, articlePaths, pagePaths, publishedTranslations } from '~/helpers/translations'
import { Locale } from '~/interfaces/locale'

describe('publishedTranslations', () => {
  it('keeps the slug and the language of each published translation', () => {
    expect(publishedTranslations([
      { documentId: 'doc', slug: 'what-is-solarpunk', locale: 'en', publishedAt: '2026-09-01T00:00:00.000Z' },
    ])).toEqual([{ locale: Locale.English, slug: 'what-is-solarpunk' }])
  })

  it('drops drafts, unknown languages and missing slugs', () => {
    expect(publishedTranslations([
      { slug: 'borrador', locale: 'es', publishedAt: null },
      { slug: 'solarpunk', locale: 'fr', publishedAt: '2026-09-01T00:00:00.000Z' },
      { slug: '', locale: 'en', publishedAt: '2026-09-01T00:00:00.000Z' },
    ])).toEqual([])
  })

  it('handles an article without localizations', () => {
    expect(publishedTranslations(undefined)).toEqual([])
    expect(publishedTranslations(null)).toEqual([])
  })
})

describe('articlePaths', () => {
  it('links each language to the slug of its own version', () => {
    expect(articlePaths('que-es-solarpunk', Locale.SpanishColombia, [{ locale: Locale.English, slug: 'what-is-solarpunk' }])).toEqual({
      es: '/es/blog/que-es-solarpunk',
      en: '/blog/what-is-solarpunk',
    })
  })

  it('lists only the current language when there is no translation', () => {
    expect(articlePaths('linux-server-hardening-guide', Locale.English, [])).toEqual({ en: '/blog/linux-server-hardening-guide' })
  })

  it('ignores a translation that claims the current language', () => {
    expect(articlePaths('what-is-solarpunk', Locale.English, [{ locale: Locale.English, slug: 'other' }])).toEqual({ en: '/blog/what-is-solarpunk' })
  })

  it('builds a single article path', () => {
    expect(articlePath('que-es-solarpunk', Locale.SpanishColombia)).toBe('/es/blog/que-es-solarpunk')
  })
})

describe('pagePaths', () => {
  it('links each locale to its own slug', () => {
    expect(pagePaths('showcase', Locale.English, [{ locale: Locale.SpanishColombia, slug: 'muestra' }]))
      .toEqual({ en: '/showcase', es: '/es/muestra' })
    expect(pagePaths('muestra', Locale.SpanishColombia, [{ locale: Locale.English, slug: 'showcase' }]))
      .toEqual({ es: '/es/muestra', en: '/showcase' })
  })

  it('has only the current locale without translations', () => {
    expect(pagePaths('showcase', Locale.English, [])).toEqual({ en: '/showcase' })
  })
})
