<script setup lang="ts">
import type { Page } from '~/interfaces'
import { warnOnce } from '~/helpers/pages'

const { locale } = useI18n()
const site = await useLoadedSite()
const { setAlternates } = useLocaleAlternates()

// The page chosen in the site settings; if it cannot be loaded the blog home shows instead
const homeSlug = site.value.homePage?.slug
const home = homeSlug ? await useSectionPage(homeSlug) : null
const sectionPage = computed<Page | undefined>(() => (home && !home.failure.value ? home.page.value : undefined))

if (homeSlug && !sectionPage.value && import.meta.server) {
  warnOnce(`${locale.value}:${homeSlug}:${home?.failure.value}`, `Home page "${homeSlug}" (${locale.value}) could not be loaded (status ${home?.failure.value}); showing the blog home`)
}

// <LazySectionRenderer> keeps the sections' CSS and chunks off the blog home
const blog = sectionPage.value ? null : useBlogHome()

if (sectionPage.value) {
  setAlternates(await useAlternates(sectionPage.value, true))
  usePageSeo(sectionPage, '/')
}
</script>

<template>
  <div v-if="sectionPage">
    <LazySectionRenderer :sections="sectionPage.sections" :page-title="sectionPage.title" />
  </div>
  <RegionHome v-else-if="blog" :featured-post="blog.featuredPost.value" :total="blog.total.value" :counts="blog.counts.value" :topics="blog.topics.value" />
</template>
