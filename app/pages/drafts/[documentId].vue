<script setup lang="ts">
import type { DraftArticleResponse, DraftViewState, Locale, StrapiPost } from '~/interfaces'
import { draftViewState } from '~/helpers/drafts'
import { isLocale } from '~/helpers/locale'
import { toStrapiPost } from '~/helpers/post'
import { articlePath } from '~/helpers/translations'
import { pageTitle } from '~/helpers/site'

definePageMeta({ middleware: 'editor' })

const { locale, t } = useI18n()
const site = useSite()
const route = useRoute()
const requestFetch = useRequestFetch()
const categoryLabel = useCategoryLabel()
const headerSection = useHeaderSection()
const { setAlternates } = useLocaleAlternates()

const documentId = route.params.documentId as string
const draftLocale: Locale = isLocale(route.query.locale) ? route.query.locale : locale.value as Locale

const { data, error } = await useAsyncData<DraftArticleResponse>(
  `draft-${documentId}-${draftLocale}`,
  () => requestFetch<DraftArticleResponse>(`/api/drafts/${encodeURIComponent(documentId)}`, { query: { locale: draftLocale } }),
)

if (error.value || !data.value) {
  const statusCode = error.value?.statusCode ?? 404
  throw createError({ statusCode, statusMessage: statusCode === 404 ? 'Page not found' : 'Failed to load draft', fatal: true })
}

const post = computed<StrapiPost | null>(() => data.value ? toStrapiPost(data.value.article) : null)
const state = computed<DraftViewState>(() => draftViewState(data.value?.article.updatedAt, data.value?.published ?? null))
const publishedPath = computed<string | null>(() => data.value?.published ? articlePath(data.value.published.slug, draftLocale) : null)

watch(() => categoryLabel(post.value?.category), (label) => {
  headerSection.value = label
}, { immediate: true })

setAlternates({})

useSeoMeta({
  title: () => pageTitle(t('drafts.meta.article', { title: post.value?.title ?? '' }), site.value.name),
  robots: 'noindex, nofollow',
})

onBeforeUnmount(() => {
  headerSection.value = ''
})
</script>

<template>
  <div v-if="post">
    <DraftsStrip
      :state="state"
      :updated-at="data?.article.updatedAt"
      :author="post.author?.name ?? ''"
      :published-path="publishedPath"
    />
    <RegionArticle :post="post" draft />
  </div>
</template>
