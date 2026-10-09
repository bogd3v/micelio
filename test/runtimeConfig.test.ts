import { describe, expect, it } from 'vitest'
import { missingOptionalRuntimeSettings, missingRuntimeSettings, modeMismatch, privacyContactWarning } from '../app/helpers/runtimeConfig'

const complete = {
  strapiApiToken: 'token',
  smtpHost: 'smtp-relay.brevo.com',
  smtpUser: 'login',
  smtpPass: 'key',
  newsletterFrom: 'BogDev <no-reply@bogdev.com.co>',
  mediaUrl: 'https://media.example.org',
  public: {
    strapiUrl: 'https://cms.example.org',
    siteUrl: 'https://example.org',
    fediverseHandle: '@site@cms.example.org',
    fediverseActorUrl: 'https://cms.example.org/fediverse/user/site',
    fediverseArticlesUrl: 'https://cms.example.org/fediverse/articles',
  },
}

describe('missingRuntimeSettings', () => {
  it('returns nothing when every required value is set', () => {
    expect(missingRuntimeSettings(complete)).toEqual([])
  })

  it('names the NUXT_* variable of each empty or missing value', () => {
    expect(missingRuntimeSettings({ ...complete, strapiApiToken: '', smtpPass: '  ', newsletterFrom: undefined })).toEqual([
      'NUXT_STRAPI_API_TOKEN',
      'NUXT_SMTP_PASS',
      'NUXT_NEWSLETTER_FROM',
    ])
  })

  it('also requires the Strapi and site URLs', () => {
    expect(missingRuntimeSettings({ ...complete, public: { ...complete.public, strapiUrl: '', siteUrl: undefined } })).toEqual([
      'NUXT_PUBLIC_STRAPI_URL',
      'NUXT_PUBLIC_SITE_URL',
    ])
    expect(missingRuntimeSettings({ ...complete, public: undefined })).toEqual(['NUXT_PUBLIC_STRAPI_URL', 'NUXT_PUBLIC_SITE_URL'])
  })
})

describe('missingOptionalRuntimeSettings', () => {
  it('returns nothing when the media host and fediverse values are set', () => {
    expect(missingOptionalRuntimeSettings(complete)).toEqual([])
  })

  it('names the empty optional values', () => {
    expect(missingOptionalRuntimeSettings({ ...complete, mediaUrl: '', public: { ...complete.public, fediverseHandle: '' } })).toEqual([
      'NUXT_MEDIA_URL',
      'NUXT_PUBLIC_FEDIVERSE_HANDLE',
    ])
  })
})

describe('modeMismatch', () => {
  it('is null when the runtime mode is the build\'s, ignoring blanks and spaces', () => {
    expect(modeMismatch({ public: { siteMode: 'static' } }, 'static')).toBeNull()
    expect(modeMismatch({ public: { siteMode: ' static ' } }, 'static')).toBeNull()
  })

  it('counts an unset or blank runtime mode as dynamic', () => {
    expect(modeMismatch({}, 'dynamic')).toBeNull()
    expect(modeMismatch({ public: { siteMode: '' } }, 'dynamic')).toBeNull()
    expect(modeMismatch({ public: { siteMode: '  ' } }, 'dynamic')).toBeNull()
    expect(modeMismatch({ public: { siteMode: '' } }, 'static')).toMatch(/"".*"static"/)
  })

  it('names both modes when they differ, and keeps an invalid value as written', () => {
    expect(modeMismatch({ public: { siteMode: 'dynamic' } }, 'static')).toMatch(/"dynamic".*"static"/)
    expect(modeMismatch({ public: { siteMode: 'hybrid' } }, 'dynamic')).toMatch(/"hybrid".*"dynamic"/)
  })
})

describe('static modes', () => {
  it('do not require SMTP or the fediverse settings', () => {
    const config = { strapiApiToken: 't', public: { strapiUrl: 'u', siteUrl: 's' } }
    expect(missingRuntimeSettings(config)).toContain('NUXT_SMTP_HOST')
    expect(missingRuntimeSettings(config, 'static')).toEqual([])
    expect(missingRuntimeSettings({ public: {} }, 'landing')).toEqual(['NUXT_STRAPI_API_TOKEN', 'NUXT_PUBLIC_STRAPI_URL', 'NUXT_PUBLIC_SITE_URL'])
    expect(missingOptionalRuntimeSettings(config)).toContain('NUXT_PUBLIC_FEDIVERSE_HANDLE')
    expect(missingOptionalRuntimeSettings(config, 'static')).toEqual(['NUXT_MEDIA_URL'])
  })
})

describe('privacyContactWarning', () => {
  const modules = { newsletter: true, comments: true, accounts: false, drafts: false, fediverse: true, search: true, support: true }

  it('names the data-collecting modules that are on when the contact email is empty', () => {
    expect(privacyContactWarning({ privacyContactEmail: '', modules }, true)).toContain('newsletter, comments')
  })

  it('is null with an email, without data-collecting modules, or when Strapi failed', () => {
    expect(privacyContactWarning({ privacyContactEmail: 'a@b.test', modules }, true)).toBeNull()
    expect(privacyContactWarning({ privacyContactEmail: ' ', modules: { ...modules, newsletter: false, comments: false } }, true)).toBeNull()
    expect(privacyContactWarning({ privacyContactEmail: '', modules }, false)).toBeNull()
  })
})
