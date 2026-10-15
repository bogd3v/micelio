import { describe, expect, it } from 'vitest'
import { siteSchema } from '~/schemas/site'
import { mergeSite, resolveSiteMedia, siteFromAppConfig } from '~/helpers/site'
import { parseSiteSettings } from '../server/schemas/site'
import type { AppSiteConfig, Site } from '~/interfaces'

const config: AppSiteConfig = {
  name: 'Micelio',
  description: '',
  url: '',
  author: { name: '', url: '' },
  socialLinks: [],
  support: { buyMeACoffee: '' },
  privacy: { contactEmail: '', updatedAt: '' },
}

const defaults = siteFromAppConfig(config)

const accents = { accent: '#1a5fb4', accentSoft: '#e3ecf8', accentHover: '#2c5282', onAccent: '#ffffff' }

describe('siteSchema', () => {
  it('accepts the neutral app.config defaults: no theme, no home page, null images', () => {
    const parsed = siteSchema.parse(JSON.parse(JSON.stringify(defaults)))
    expect(parsed.logo).toBeNull()
    expect(parsed.theme).toBeUndefined()
    expect('homePage' in parsed).toBe(false)
  })

  it('accepts a full Strapi merge with theme overrides and a home page', () => {
    const settings = resolveSiteMedia(parseSiteSettings({
      name: 'Field Notes',
      url: 'https://notes.example.com',
      author: { name: 'Ada', url: 'https://ada.example.com' },
      logo: { url: '/uploads/logo.svg', alternativeText: null, width: 120, height: 40, id: 9 },
      socialLinks: [{ network: 'mastodon', url: 'https://social.example.com/@ada' }, { network: 'nope', url: 'x' }],
      contactEmail: 'hi@example.com',
      privacyUpdatedAt: '2026-01-02T00:00:00.000Z',
      modules: { comments: false },
      homePage: { slug: 'showcase' },
    }), 'https://cms.example.com')
    const site: Site = {
      ...mergeSite(defaults, settings),
      theme: { id: 'bogota', defaultMode: 'dia', displayFont: 'fraunces', accents: { dia: accents, noche: accents } },
    }
    const parsed = siteSchema.parse(JSON.parse(JSON.stringify(site)))
    expect(parsed.logo).toEqual({ url: 'https://cms.example.com/uploads/logo.svg', width: 120, height: 40 })
    expect(parsed.socialLinks).toHaveLength(1)
    expect(parsed.modules.comments).toBe(false)
    expect(parsed.homePage).toEqual({ slug: 'showcase' })
    expect(parsed.theme?.accents.dia).toEqual(accents)
  })

  it('rejects a wrong shape and an extra key', () => {
    const site = JSON.parse(JSON.stringify(defaults))
    expect(siteSchema.safeParse({ ...site, extra: 1 }).success).toBe(false)
    expect(siteSchema.safeParse({ ...site, defaultLocale: 'fr' }).success).toBe(false)
    expect(siteSchema.safeParse({ ...site, modules: { ...site.modules, comments: 'yes' } }).success).toBe(false)
    expect(siteSchema.safeParse({ ...site, logo: undefined }).success).toBe(false)
    expect(siteSchema.safeParse({ ...site, theme: { id: 'bogota', accents: { dia: { ...accents, accent: 'blue' } } } }).success).toBe(false)
    expect(siteSchema.safeParse({ ...site, theme: { id: 'bogota', accents: {}, extra: 1 } }).success).toBe(false)
    expect(siteSchema.safeParse({ ...site, homePage: { slug: 'a', extra: 1 } }).success).toBe(false)
  })
})
