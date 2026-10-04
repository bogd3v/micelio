import { describe, expect, it } from 'vitest'
import { missingOptionalRuntimeSettings, missingRuntimeSettings } from '../app/helpers/runtimeConfig'

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
