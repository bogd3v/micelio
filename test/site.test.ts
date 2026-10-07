import { describe, expect, it } from 'vitest'
import { absoluteUrl, ALL_MODULES_ON, defaultOgImageUrl, fediverseUser, iconType, mergeSite, pageTitle, resolveSiteImage, resolveSiteMedia, siteFromAppConfig, siteLogoUrl, xHandle } from '../app/helpers/site'
import type { AppSiteConfig } from '../app/helpers/site'
import { parseSiteSettings } from '../server/schemas/site'
import { Locale } from '../app/interfaces/locale'

const appSite: AppSiteConfig = {
  name: 'Example',
  description: 'A blog',
  url: 'https://example.org',
  author: { name: 'Ada', url: 'https://example.org/about' },
  socialLinks: [
    { network: 'linkedin', url: 'https://linkedin.com/in/ada' },
    { network: 'github', url: 'https://github.com/ada' },
  ],
  support: { buyMeACoffee: 'ada' },
  privacy: { contactEmail: 'ada@example.org', updatedAt: '2026-10-01T12:00:00-05:00' },
}

const defaults = siteFromAppConfig(appSite)

describe('siteFromAppConfig', () => {
  it('maps app.config to the site shape with every module on', () => {
    expect(defaults).toEqual({
      name: 'Example',
      description: 'A blog',
      url: 'https://example.org',
      defaultLocale: Locale.English,
      author: { name: 'Ada', url: 'https://example.org/about' },
      logo: null,
      favicon: null,
      defaultOgImage: null,
      socialLinks: [
        { network: 'linkedin', url: 'https://linkedin.com/in/ada' },
        { network: 'github', url: 'https://github.com/ada' },
      ],
      contactEmail: 'ada@example.org',
      privacyContactEmail: 'ada@example.org',
      privacyUpdatedAt: '2026-10-01T12:00:00-05:00',
      supportHandle: 'ada',
      modules: ALL_MODULES_ON,
    })
  })
})

describe('siteFromAppConfig favicon', () => {
  it('keeps the favicon app.config declares', () => {
    expect(siteFromAppConfig({ ...appSite, favicon: { url: '/icon.svg' } }, '/theme/images/f.svg').favicon).toEqual({ url: '/icon.svg' })
  })

  it('falls back to the theme\'s favicon, and to none', () => {
    expect(siteFromAppConfig({ ...appSite, favicon: undefined }, '/theme/images/f.svg').favicon).toEqual({ url: '/theme/images/f.svg' })
    expect(siteFromAppConfig({ ...appSite, favicon: undefined }).favicon).toBeNull()
  })
})

describe('defaultOgImageUrl', () => {
  const media = (url: string): string => `https://cms.example${url}`

  it('prefers the site\'s default image over the theme\'s', () => {
    expect(defaultOgImageUrl({ defaultOgImage: { url: '/uploads/og.png' } }, '/theme/images/og.png', 'https://example.org', media)).toBe('https://cms.example/uploads/og.png')
  })

  it('falls back to the theme\'s image as an absolute URL, and to none', () => {
    expect(defaultOgImageUrl({ defaultOgImage: null }, '/theme/images/og.png', 'https://example.org/', media)).toBe('https://example.org/theme/images/og.png')
    expect(defaultOgImageUrl({ defaultOgImage: null }, undefined, 'https://example.org', media)).toBeUndefined()
  })
})

describe('xHandle', () => {
  it('reads the user of an X or Twitter link', () => {
    expect(xHandle([{ network: 'x', url: 'https://x.com/devbog' }])).toBe('@devbog')
    expect(xHandle([{ network: 'x', url: 'https://twitter.com/@devbog/' }])).toBe('@devbog')
  })

  it('returns null without an X link or with one it cannot read', () => {
    expect(xHandle([{ network: 'github', url: 'https://github.com/ada' }])).toBeNull()
    expect(xHandle([{ network: 'x', url: 'https://x.com/devbog/status/1' }])).toBeNull()
  })
})

describe('fediverseUser', () => {
  it('keeps the local part of a handle', () => {
    expect(fediverseUser('@bogdev@api.bogdev.com.co')).toBe('@bogdev')
    expect(fediverseUser('bogdev@example.org')).toBe('@bogdev')
    expect(fediverseUser('')).toBe('')
  })
})

describe('iconType', () => {
  it('reads the media type from the extension', () => {
    expect(iconType('/bogdev.svg')).toBe('image/svg+xml')
    expect(iconType('https://cdn.test/avatar.PNG?v=2')).toBe('image/png')
    expect(iconType('/favicon.ico')).toBe('image/x-icon')
  })

  it('leaves an unknown extension to the browser', () => {
    expect(iconType('/icon')).toBeUndefined()
  })
})

describe('page helpers', () => {
  it('puts the site name after the page title', () => {
    expect(pageTitle('Blog', 'Micelio')).toBe('Blog - Micelio')
  })

  it('makes paths absolute and keeps absolute URLs', () => {
    expect(absoluteUrl('/bogdev.svg', 'https://example.org/')).toBe('https://example.org/bogdev.svg')
    expect(absoluteUrl('https://cdn.test/logo.png', 'https://example.org')).toBe('https://cdn.test/logo.png')
  })

  it('prefers the logo, then the favicon, for structured data', () => {
    expect(siteLogoUrl({ logo: { url: 'https://cdn.test/logo.png' }, favicon: { url: '/icon.svg' } }, 'https://example.org')).toBe('https://cdn.test/logo.png')
    expect(siteLogoUrl({ logo: null, favicon: { url: '/icon.svg' } }, 'https://example.org')).toBe('https://example.org/icon.svg')
    expect(siteLogoUrl({ logo: null, favicon: null }, 'https://example.org')).toBeUndefined()
  })
})

describe('mergeSite', () => {
  it('keeps the defaults when Strapi gave nothing', () => {
    expect(mergeSite(defaults, null)).toBe(defaults)
    expect(mergeSite(defaults, {})).toEqual(defaults)
  })

  it('takes Strapi values field by field and ignores empty ones', () => {
    const site = mergeSite(defaults, {
      name: 'Micelio',
      description: '  ',
      author: { name: 'Grace' },
      socialLinks: [],
      logo: { url: '/uploads/logo.svg' },
      modules: { comments: false },
    })
    expect(site.name).toBe('Micelio')
    expect(site.description).toBe('A blog')
    expect(site.author).toEqual({ name: 'Grace', url: 'https://example.org/about' })
    expect(site.socialLinks).toEqual(defaults.socialLinks)
    expect(site.logo).toEqual({ url: '/uploads/logo.svg' })
    expect(site.modules).toEqual({ ...ALL_MODULES_ON, comments: false })
  })
})

describe('parseSiteSettings', () => {
  it('reads a full site-setting from Strapi', () => {
    expect(parseSiteSettings({
      id: 1,
      documentId: 'site',
      name: 'Micelio',
      description: 'An engine',
      url: 'https://micelio.dev',
      defaultLocale: 'es',
      author: { id: 2, name: 'Grace', url: 'https://micelio.dev/about' },
      logo: { url: '/uploads/logo.svg', alternativeText: null, width: 120, height: 40 },
      favicon: null,
      socialLinks: [{ id: 3, network: 'mastodon', url: 'https://mastodon.social/@micelio' }],
      contactEmail: 'hola@micelio.dev',
      privacyContactEmail: null,
      privacyUpdatedAt: '2026-10-03T10:00:00.000Z',
      supportHandle: 'micelio',
      modules: { id: 4, newsletter: true, comments: false, accounts: true, drafts: true, fediverse: false, search: true, support: true },
    })).toEqual({
      name: 'Micelio',
      description: 'An engine',
      url: 'https://micelio.dev',
      defaultLocale: Locale.SpanishColombia,
      author: { name: 'Grace', url: 'https://micelio.dev/about' },
      logo: { url: '/uploads/logo.svg', alternativeText: undefined, width: 120, height: 40 },
      favicon: undefined,
      defaultOgImage: undefined,
      socialLinks: [{ network: 'mastodon', url: 'https://mastodon.social/@micelio' }],
      contactEmail: 'hola@micelio.dev',
      privacyContactEmail: undefined,
      privacyUpdatedAt: '2026-10-03T10:00:00.000Z',
      supportHandle: 'micelio',
      modules: { newsletter: true, comments: false, accounts: true, drafts: true, fediverse: false, search: true, support: true },
    })
  })

  it('drops each invalid field on its own', () => {
    const settings = parseSiteSettings({
      name: 'Micelio',
      url: 'not a url',
      defaultLocale: 'fr',
      contactEmail: 'nope',
      supportHandle: 'with spaces',
      privacyUpdatedAt: 'yesterday',
      logo: { alternativeText: 'no url' },
      socialLinks: [{ network: 'myspace', url: 'https://myspace.com/x' }, { network: 'github', url: 'https://github.com/micelio' }],
      modules: { comments: 'no', search: false },
    })
    expect(settings).toMatchObject({
      name: 'Micelio',
      url: undefined,
      defaultLocale: undefined,
      contactEmail: undefined,
      supportHandle: undefined,
      privacyUpdatedAt: undefined,
      logo: undefined,
      socialLinks: [{ network: 'github', url: 'https://github.com/micelio' }],
      modules: { comments: undefined, search: false },
    })
    expect(mergeSite(defaults, settings).url).toBe('https://example.org')
  })

  it('returns null for something that is not an object', () => {
    expect(parseSiteSettings(undefined)).toBeNull()
    expect(parseSiteSettings('site')).toBeNull()
  })
})

describe('parseSiteSettings theme', () => {
  const theme = (value: unknown): ReturnType<typeof parseSiteSettings> => parseSiteSettings({ theme: value })

  it('is absent when Strapi sends null or nothing', () => {
    expect(theme(null)?.theme).toBeUndefined()
    expect(parseSiteSettings({})?.theme).toBeUndefined()
    expect(theme('dark')?.theme).toBeUndefined()
  })

  it('reads a saved component, with null for what was never set', () => {
    expect(theme({ id: 1, themeId: null, defaultMode: 'dia', accentOverrides: [], displayFont: null })?.theme).toEqual({ defaultMode: 'dia', accentOverrides: [] })
    expect(theme({ themeId: 'bogota', defaultMode: 'noche', displayFont: 'fraunces' })?.theme).toEqual({ themeId: 'bogota', defaultMode: 'noche', displayFont: 'fraunces' })
  })

  it('drops a slug or font that is not valid, alone', () => {
    expect(theme({ themeId: 'Bogota', defaultMode: '1dia', displayFont: 'comic-sans' })?.theme).toEqual({})
    expect(theme({ themeId: 'bogota', defaultMode: 'dia x' })?.theme).toEqual({ themeId: 'bogota' })
  })

  it('validates accent overrides item by item and keeps the first of each mode', () => {
    const overrides = [
      { id: 1, mode: 'dia', color: '#AABBCC' },
      { mode: 'dia', color: '#112233' },
      { mode: 'noche', color: 'red' },
      { mode: 'noche', color: '#12345' },
      { mode: 'Noche', color: '#123456' },
      { mode: 'noche', color: '#123456ff' },
      { mode: 'sepia' },
      null,
      { mode: 'noche', color: '#123456' },
    ]
    expect(theme({ accentOverrides: overrides })?.theme?.accentOverrides).toEqual([
      { mode: 'dia', color: '#AABBCC' },
      { mode: 'noche', color: '#123456' },
    ])
  })

  it('drops an accentOverrides list longer than 16', () => {
    const many = Array.from({ length: 17 }, (_, index) => ({ mode: `m${index}`, color: '#123456' }))
    expect(theme({ accentOverrides: many, defaultMode: 'dia' })?.theme).toEqual({ defaultMode: 'dia' })
    expect(theme({ accentOverrides: many.slice(0, 16) })?.theme?.accentOverrides).toHaveLength(16)
  })

  it('drops accentOverrides that is not a list', () => {
    expect(theme({ accentOverrides: { mode: 'dia', color: '#123456' }, defaultMode: 'dia' })?.theme).toEqual({ defaultMode: 'dia' })
  })
})

describe('homePage', () => {
  it('keeps a valid slug and drops null, a bad slug or extra fields', () => {
    expect(parseSiteSettings({ homePage: { id: 1, documentId: 'x', slug: 'showcase' } })?.homePage).toEqual({ slug: 'showcase' })
    expect(parseSiteSettings({ homePage: null })?.homePage).toBeUndefined()
    expect(parseSiteSettings({ homePage: { slug: 'Not A Slug' }, name: 'Micelio' })).toEqual({ name: 'Micelio' })
    expect(parseSiteSettings({ homePage: { slug: '../x' } })?.homePage).toBeUndefined()
    expect(parseSiteSettings({ homePage: 'showcase' })?.homePage).toBeUndefined()
  })

  it('merges into the site only when set', () => {
    expect(mergeSite(defaults, { homePage: { slug: 'showcase' } }).homePage).toEqual({ slug: 'showcase' })
    expect('homePage' in mergeSite(defaults, { name: 'Micelio' })).toBe(false)
  })
})

describe('resolveSiteMedia', () => {
  const strapi = 'https://cms.example.org/'

  it('resolves relative URLs against the Strapi public URL', () => {
    expect(resolveSiteImage({ url: '/uploads/logo.svg', width: 10 }, strapi)).toEqual({ url: 'https://cms.example.org/uploads/logo.svg', width: 10 })
    expect(resolveSiteImage({ url: 'uploads/logo.svg' }, strapi)).toEqual({ url: 'https://cms.example.org/uploads/logo.svg' })
  })

  it('keeps URLs with a scheme and makes protocol-relative ones https', () => {
    expect(resolveSiteImage({ url: 'https://cdn.test/a.png' }, strapi)).toEqual({ url: 'https://cdn.test/a.png' })
    expect(resolveSiteImage({ url: 'data:image/png;base64,AAA' }, strapi)).toEqual({ url: 'data:image/png;base64,AAA' })
    expect(resolveSiteImage({ url: 'blob:https://x.test/1' }, strapi)).toEqual({ url: 'blob:https://x.test/1' })
    expect(resolveSiteImage({ url: '//cdn.test/a.png' }, strapi)).toEqual({ url: 'https://cdn.test/a.png' })
  })

  it('passes empty values through', () => {
    expect(resolveSiteImage(null, strapi)).toBeNull()
    expect(resolveSiteImage(undefined, strapi)).toBeUndefined()
    expect(resolveSiteImage({ url: '' }, strapi)).toEqual({ url: '' })
    expect(resolveSiteMedia(null, strapi)).toBeNull()
  })

  it('resolves logo, favicon and defaultOgImage of the settings', () => {
    const settings = resolveSiteMedia({ name: 'X', logo: { url: '/uploads/l.svg' }, favicon: { url: 'https://cdn.test/f.ico' }, defaultOgImage: { url: '/uploads/o.png' } }, strapi)
    expect(settings).toMatchObject({
      name: 'X',
      logo: { url: 'https://cms.example.org/uploads/l.svg' },
      favicon: { url: 'https://cdn.test/f.ico' },
      defaultOgImage: { url: 'https://cms.example.org/uploads/o.png' },
    })
  })
})
