<script setup lang="ts">
import { defaultLocale, Locale } from '~/interfaces'
import { iconType, xHandle } from '~/helpers/site'

const { locale, localeProperties } = useI18n()
const { localePaths } = useLocaleUtils()
const { alternates } = useLocaleAlternates()
const route = useRoute()
const { siteUrl } = useSiteUrl()
const site = useSite()
const { blogEnabled } = useStaticSite()

const hreflangLinks = computed(() => {
  if (alternates.value?.path === route.path && alternates.value.hreflang === false) return []
  const paths = localePaths.value
  const fallback = paths[defaultLocale] ?? paths[locale.value as Locale]
  const hreflangs = [
    ...Object.values(Locale).filter(code => paths[code]).map(code => ({ hreflang: code as string, path: paths[code] })),
    ...(fallback ? [{ hreflang: 'x-default', path: fallback }] : []),
  ]
  return hreflangs.map(({ hreflang, path }) => ({ rel: 'alternate' as const, hreflang, href: `${siteUrl.value}${path}` }))
})

// og:locale uses underscores (en-US -> en_US, es -> es); the language comes from the i18n config (nuxt.config.ts)
const ogLocale = computed<string>(() => (localeProperties.value.language ?? locale.value).replace('-', '_'))
const twitterSite = computed<string | null>(() => xHandle(site.value.socialLinks))

useHead({
  htmlAttrs: {
    lang: () => locale.value as Locale,
  },
  title: () => site.value.name,
  meta: () => [
    { name: 'author', content: site.value.name },
    { property: 'og:site_name', content: site.value.name },
    ...(twitterSite.value ? [{ name: 'twitter:site', content: twitterSite.value }] : []),
    { property: 'og:locale', content: ogLocale.value },
  ],
  link: () => [
    ...(site.value.favicon ? [{ rel: 'icon' as const, type: iconType(site.value.favicon.url), href: site.value.favicon.url }] : []),
    ...(blogEnabled ? [{ rel: 'alternate' as const, type: 'application/rss+xml', title: `${site.value.name} RSS Feed`, href: '/feed.xml' }] : []),
    ...hreflangLinks.value,
  ],
})
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
