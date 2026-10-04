import { describe, expect, it } from 'vitest'
import { effectiveModules, isModuleEnabled, moduleForPath } from '../app/helpers/modules'
import { moduleRequirements } from '../app/helpers/runtimeConfig'
import { ALL_MODULES_ON } from '../app/helpers/site'

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
  const configured = { smtp: true, fediverse: true }

  it('keeps Strapi\'s switches when everything is configured', () => {
    expect(effectiveModules(ALL_MODULES_ON, configured)).toEqual(ALL_MODULES_ON)
    expect(effectiveModules({ ...ALL_MODULES_ON, search: false }, configured).search).toBe(false)
  })

  it('turns off the newsletter without SMTP and the fediverse without its settings', () => {
    expect(effectiveModules(ALL_MODULES_ON, { smtp: false, fediverse: false })).toMatchObject({ newsletter: false, fediverse: false, comments: true })
  })

  it('turns drafts off with accounts', () => {
    expect(effectiveModules({ ...ALL_MODULES_ON, accounts: false }, configured).drafts).toBe(false)
  })

  it('reads one module', () => {
    expect(isModuleEnabled({ ...ALL_MODULES_ON, comments: false }, 'comments')).toBe(false)
  })
})

describe('moduleRequirements', () => {
  const fediverse = { fediverseHandle: '@a@b.c', fediverseActorUrl: 'https://b.c/a', fediverseArticlesUrl: 'https://b.c/articles' }

  it('needs the four SMTP values and the three fediverse ones', () => {
    expect(moduleRequirements({ smtpHost: 'h', smtpUser: 'u', smtpPass: 'p', newsletterFrom: 'f', public: fediverse })).toEqual({ smtp: true, fediverse: true })
    expect(moduleRequirements({ smtpHost: 'h', smtpUser: '', smtpPass: 'p', newsletterFrom: 'f', public: { ...fediverse, fediverseActorUrl: '' } })).toEqual({ smtp: false, fediverse: false })
  })
})
