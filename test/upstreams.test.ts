import { describe, expect, it } from 'vitest'
import { insecureUpstream } from '../server/lib/upstreams'

describe('insecureUpstream', () => {
  it('accepts https, private hosts and services that are not configured', () => {
    expect(insecureUpstream([
      { variable: 'NUXT_PUBLIC_STRAPI_URL', url: 'https://cms.example.org' },
      { variable: 'NUXT_UMAMI_URL', url: 'http://umami:3000' },
    ])).toBeNull()
    expect(insecureUpstream([
      { variable: 'NUXT_PUBLIC_STRAPI_URL', url: 'http://10.0.0.4:1337' },
      { variable: 'NUXT_UMAMI_URL', url: '' },
    ])).toBeNull()
  })

  it('names the first variable that is plain http outside a private network', () => {
    expect(insecureUpstream([
      { variable: 'NUXT_PUBLIC_STRAPI_URL', url: 'http://cms.example.org' },
      { variable: 'NUXT_UMAMI_URL', url: 'http://stats.example.org' },
    ])).toContain('NUXT_PUBLIC_STRAPI_URL')
    expect(insecureUpstream([
      { variable: 'NUXT_PUBLIC_STRAPI_URL', url: 'https://cms.example.org' },
      { variable: 'NUXT_UMAMI_URL', url: 'http://203.0.113.9:3000' },
    ])).toContain('NUXT_UMAMI_URL')
  })
})
