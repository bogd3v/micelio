import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSiteUrl } from '~/composables/useSiteUrl'
import { useLocaleUtils } from '~/composables/useLocaleUtils'
import { useCanonicalUrl } from '~/composables/useCanonicalUrl'

interface PublicRuntimeConfig {
  siteUrl: string
}

const localeRef = ref<string>('en')
const publicConfig: PublicRuntimeConfig = { siteUrl: '' }

vi.stubGlobal('computed', computed)
vi.stubGlobal('useSiteUrl', useSiteUrl)
vi.stubGlobal('useLocaleUtils', useLocaleUtils)
vi.stubGlobal('useRuntimeConfig', () => ({ public: publicConfig }))
// Without NUXT_PUBLIC_SITE_URL, useSiteUrl falls back to the site's own URL
vi.stubGlobal('useSite', () => computed(() => ({ url: 'https://bogdev.com.co' })))
vi.stubGlobal('useI18n', () => ({
  locale: localeRef,
  locales: ref([{ code: 'en' }, { code: 'es' }]),
}))
vi.stubGlobal('useRoute', () => ({ path: '/' }))
vi.stubGlobal('useLocaleAlternates', () => ({ alternates: ref(null), setAlternates: () => {} }))

describe('useCanonicalUrl', () => {
  beforeEach(() => {
    localeRef.value = 'en'
    publicConfig.siteUrl = ''
  })

  it('builds the canonical URL for the default locale', () => {
    const { canonicalUrl } = useCanonicalUrl('/blog')
    expect(canonicalUrl.value).toBe('https://bogdev.com.co/blog')
  })

  it('prefixes the path for non-default locales', () => {
    localeRef.value = 'es'
    const { canonicalUrl } = useCanonicalUrl('/blog')
    expect(canonicalUrl.value).toBe('https://bogdev.com.co/es/blog')
  })

  it('handles the root path', () => {
    expect(useCanonicalUrl('/').canonicalUrl.value).toBe('https://bogdev.com.co/')
    localeRef.value = 'es'
    expect(useCanonicalUrl('/').canonicalUrl.value).toBe('https://bogdev.com.co/es')
  })

  it('normalizes paths without a leading slash', () => {
    expect(useCanonicalUrl('blog').canonicalUrl.value).toBe('https://bogdev.com.co/blog')
  })

  it('uses the configured siteUrl when present', () => {
    publicConfig.siteUrl = 'https://example.com'
    expect(useCanonicalUrl('/blog').canonicalUrl.value).toBe('https://example.com/blog')
  })

  it('reacts to locale changes', () => {
    const { canonicalUrl } = useCanonicalUrl('/blog')
    expect(canonicalUrl.value).toBe('https://bogdev.com.co/blog')
    localeRef.value = 'es'
    expect(canonicalUrl.value).toBe('https://bogdev.com.co/es/blog')
  })
})
