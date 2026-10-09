<script setup lang="ts">
import { PAGE_SLUG_PATTERN } from '~/constants/pages'

// A slug the API would reject (400, e.g. "Showcase") is a page that does not exist: 404 without the call
definePageMeta({ validate: route => PAGE_SLUG_PATTERN.test(String(route.params.slug)) })

const route = useRoute()
const slug = route.params.slug as string
const site = await useLoadedSite()
const { isStatic } = useStaticSite()
const { setAlternates } = useLocaleAlternates()

// The page set as the home page keeps answering here, with `/` as its canonical (no redirect)
const isHome = site.value.homePage?.slug === slug

const { page, failure } = await useSectionPage(slug)

if (failure.value || !page.value) {
  const status = failure.value ?? 500
  const notFound = status === 404 || status === 400
  throw createError({
    statusCode: notFound ? 404 : status,
    statusMessage: notFound ? 'Page not found' : 'Failed to load page',
    fatal: true,
  })
}

setAlternates(await useAlternates(page.value, isHome))

usePageSeo(page, isHome ? '/' : `/${slug}`)
</script>

<template>
  <div :data-pagefind-body="isStatic && !isHome ? '' : undefined" :data-pagefind-meta="isStatic && !isHome ? 'kind:page' : undefined">
    <SectionRenderer :sections="page?.sections" :page-title="page?.title" />
  </div>
</template>
