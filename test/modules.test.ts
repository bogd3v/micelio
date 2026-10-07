import { describe, expect, it } from 'vitest'
import { effectiveModules, fallbackModules, isModuleEnabled, moduleForPath } from '../app/helpers/modules'
import { moduleRequirements } from '../app/helpers/runtimeConfig'
import { ALL_MODULES_ON } from '../app/helpers/site'
import { SITE_MODES } from '../app/helpers/siteMode'
import { SITE_MODULES } from '../app/interfaces/site'

describe('moduleForPath', () => {
  it('maps API routes and pages to their module, in both locales', () => {
    expect(moduleForPath('/api/newsletter/subscribe')).toBe('newsletter')
    expect(moduleForPath('/confirm?token=x')).toBe('newsletter')
    expect(moduleForPath('/es/newsletter/unsubscribe')).toBe('newsletter')
    expect(moduleForPath('/api/comments/flat')).toBe('comments')
    expect(moduleForPath('/account')).toBe('accounts')
    expect(moduleForPath('/es/account/sign-in')).toBe('accounts')
    expect(moduleForPath('/api/auth/me')).toBe('accounts')
    expect(moduleForPath('/drafts/doc-1')).toBe('drafts')
    expect(moduleForPath('/api/fediverse/stats')).toBe('fediverse')
    expect(moduleForPath('/api/search')).toBe('search')
  })

  it('leaves everything else to every site', () => {
    for (const path of ['/', '/es', '/blog', '/blog/accounting-basics', '/accountant', '/api/posts', '/api/site', '/api/searchable', '/_nuxt/app.js', '/feed.xml']) {
      expect(moduleForPath(path), path).toBeNull()
    }
  })
})

describe('effectiveModules', () => {
  const configured = { smtp: true, fediverse: true, formAction: false }

  it('keeps Strapi\'s switches when everything is configured', () => {
    expect(effectiveModules(ALL_MODULES_ON, configured)).toEqual(ALL_MODULES_ON)
    expect(effectiveModules({ ...ALL_MODULES_ON, search: false }, configured).search).toBe(false)
  })

  it('turns off the newsletter without SMTP and the fediverse without its settings', () => {
    expect(effectiveModules(ALL_MODULES_ON, { smtp: false, fediverse: false, formAction: false })).toMatchObject({ newsletter: false, fediverse: false, comments: true })
  })

  it('turns drafts off with accounts', () => {
    expect(effectiveModules({ ...ALL_MODULES_ON, accounts: false }, configured).drafts).toBe(false)
  })

  it('is the dynamic mode by default', () => {
    expect(effectiveModules(ALL_MODULES_ON, configured, 'dynamic')).toEqual(effectiveModules(ALL_MODULES_ON, configured))
  })

  it.each(['static', 'landing'] as const)('turns off the server modules in %s', (mode) => {
    expect(effectiveModules(ALL_MODULES_ON, { smtp: true, fediverse: true, formAction: true }, mode)).toEqual({
      ...ALL_MODULES_ON, comments: false, accounts: false, drafts: false, fediverse: false,
    })
  })

  it.each(['static', 'landing'] as const)('keeps the newsletter in %s only with an external form, ignoring SMTP', (mode) => {
    expect(effectiveModules(ALL_MODULES_ON, { smtp: true, fediverse: true, formAction: false }, mode).newsletter).toBe(false)
    expect(effectiveModules(ALL_MODULES_ON, { smtp: false, fediverse: false, formAction: true }, mode).newsletter).toBe(true)
    expect(effectiveModules({ ...ALL_MODULES_ON, newsletter: false }, { smtp: true, fediverse: true, formAction: true }, mode).newsletter).toBe(false)
  })

  it.each(SITE_MODES)('keeps search and support as Strapi sets them in %s', (mode) => {
    const all = { smtp: true, fediverse: true, formAction: true }
    expect(effectiveModules(ALL_MODULES_ON, all, mode)).toMatchObject({ search: true, support: true })
    expect(effectiveModules({ ...ALL_MODULES_ON, search: false, support: false }, all, mode)).toMatchObject({ search: false, support: false })
  })

  it('never turns on a module Strapi turned off, in any mode', () => {
    const off = Object.fromEntries(SITE_MODULES.map(module => [module, false])) as typeof ALL_MODULES_ON
    for (const mode of SITE_MODES) {
      expect(effectiveModules(off, { smtp: true, fediverse: true, formAction: true }, mode)).toEqual(off)
    }
  })

  it('reads one module', () => {
    expect(isModuleEnabled({ ...ALL_MODULES_ON, comments: false }, 'comments')).toBe(false)
  })
})

describe('moduleRequirements', () => {
  const fediverse = { fediverseHandle: '@a@b.c', fediverseActorUrl: 'https://b.c/a', fediverseArticlesUrl: 'https://b.c/articles' }

  it('needs the four SMTP values and the three fediverse ones', () => {
    expect(moduleRequirements({ smtpHost: 'h', smtpUser: 'u', smtpPass: 'p', newsletterFrom: 'f', public: fediverse })).toEqual({ smtp: true, fediverse: true, formAction: false })
    expect(moduleRequirements({ smtpHost: 'h', smtpUser: '', smtpPass: 'p', newsletterFrom: 'f', public: { ...fediverse, fediverseActorUrl: '' } })).toEqual({ smtp: false, fediverse: false, formAction: false })
  })
})

describe('moduleRequirements formAction', () => {
  it('is set by NUXT_PUBLIC_NEWSLETTER_FORM_ACTION', () => {
    expect(moduleRequirements({ public: { newsletterFormAction: 'https://buttondown.com/api/emails/embed-subscribe/x' } }).formAction).toBe(true)
    expect(moduleRequirements({ public: { newsletterFormAction: ' ' } }).formAction).toBe(false)
  })
})

describe('fallbackModules', () => {
  it('keeps everything on in dynamic mode', () => {
    expect(fallbackModules(ALL_MODULES_ON, 'dynamic', '')).toEqual(ALL_MODULES_ON)
  })

  it('applies the static restrictions, with the newsletter on only with a form action', () => {
    expect(fallbackModules(ALL_MODULES_ON, 'static', '')).toEqual({ ...ALL_MODULES_ON, comments: false, accounts: false, drafts: false, fediverse: false, newsletter: false })
    expect(fallbackModules(ALL_MODULES_ON, 'landing', 'https://p.example/subscribe').newsletter).toBe(true)
  })
})
