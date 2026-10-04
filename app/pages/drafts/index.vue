<script setup lang="ts">
import type { Category, DraftFilter, DraftListResponse, DraftState } from '~/interfaces'
import { DRAFT_FILTERS, countDrafts, draftStateKey, filterDrafts } from '~/helpers/drafts'
import { isCategory } from '~/helpers/categories'
import { formatDotDateTime } from '~/helpers/formatDate'
import { pageTitle } from '~/helpers/site'

interface DraftRow {
  key: string
  title: string
  path: string
  author: string
  category: Category | undefined
  language: string
  editedAt: string
  edited: string
  state: DraftState
  to: { path: string, query: { locale: string } }
}

definePageMeta({ middleware: 'editor' })

const { t } = useI18n()
const { localizePath } = useLocaleUtils()
const site = useSite()
const { setAlternates } = useLocaleAlternates()
const { count } = useDraftCount()
const config = useRuntimeConfig()
const requestFetch = useRequestFetch()

const { data, error } = await useAsyncData<DraftListResponse>('drafts', () => requestFetch<DraftListResponse>('/api/drafts'))

if (error.value || !data.value) {
  const statusCode = error.value?.statusCode ?? 404
  throw createError({ statusCode, statusMessage: statusCode === 404 ? 'Page not found' : 'Failed to load drafts', fatal: true })
}

const filter = ref<DraftFilter>('all')

const drafts = computed(() => data.value?.data ?? [])
const strapiAdminUrl = computed<string>(() => `${config.public.strapiUrl.replace(/\/$/, '')}/admin`)
const filters = computed<{ id: DraftFilter, label: string, count: number }[]>(() =>
  DRAFT_FILTERS.map(id => ({ id, label: t(`drafts.filters.${draftStateKey(id)}`), count: countDrafts(drafts.value, id) })),
)
const rows = computed<DraftRow[]>(() =>
  filterDrafts(drafts.value, filter.value).map(draft => ({
    key: `${draft.documentId}-${draft.locale}`,
    title: draft.title,
    path: draft.slug ? `/${draft.slug}` : '',
    author: draft.author?.name ?? '',
    category: categoryOf(draft.category?.slug),
    language: draft.locale.toUpperCase(),
    editedAt: draft.updatedAt,
    edited: formatDotDateTime(draft.updatedAt),
    state: draft.state,
    to: { path: localizePath(`/drafts/${encodeURIComponent(draft.documentId)}`), query: { locale: draft.locale } },
  })),
)

function categoryOf(slug: string | null | undefined): Category | undefined {
  return isCategory(slug) ? slug : undefined
}

function stateLabel(state: DraftState): string {
  return t(`drafts.state.${draftStateKey(state)}`)
}

setAlternates({})

useSeoMeta({
  title: () => pageTitle(t('drafts.meta.list'), site.value.name),
  robots: 'noindex, nofollow',
})

onMounted(() => {
  watch(() => data.value?.meta.count, (value) => {
    if (value !== undefined) count.value = value
  }, { immediate: true })
})
</script>

<template>
  <div class="bd-drafts-page">
    <header class="bd-drafts-head">
      <div class="bd-drafts-intro">
        <p class="bd-eyebrow bd-drafts-eyebrow">
          <span class="bd-badge bd-badge-editor">{{ t('drafts.editorsOnly') }}</span>
          {{ t('drafts.total', drafts.length) }}
        </p>
        <h1 class="bd-drafts-title bd-wide">{{ t('drafts.title') }}</h1>
        <p class="bd-drafts-lead">{{ t('drafts.lead') }}</p>
      </div>
      <div class="bd-drafts-note">
        <p class="bd-meta">{{ t('drafts.note') }}</p>
        <a
          class="bd-chip bd-drafts-strapi"
          :href="strapiAdminUrl"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="t('drafts.openStrapiLabel')"
        >
          {{ t('drafts.openStrapi') }} <span aria-hidden="true">↗</span>
        </a>
      </div>
    </header>

    <div v-if="drafts.length" role="group" class="bd-drafts-filters" :aria-label="t('drafts.filters.label')">
      <button
        v-for="item in filters"
        :key="item.id"
        type="button"
        class="bd-chip"
        :aria-pressed="filter === item.id ? 'true' : 'false'"
        @click="filter = item.id"
      >
        {{ item.label }} <span class="bd-drafts-filter-count">{{ item.count }}</span>
      </button>
    </div>

    <template v-if="rows.length">
      <table class="bd-drafts-table">
        <caption class="bd-sr">{{ t('drafts.table.caption') }}</caption>
        <thead>
          <tr>
            <th scope="col" class="bd-drafts-col-state">{{ t('drafts.table.state') }}</th>
            <th scope="col">{{ t('drafts.table.article') }}</th>
            <th scope="col" class="bd-drafts-col-category">{{ t('drafts.table.category') }}</th>
            <th scope="col" class="bd-drafts-col-language">{{ t('drafts.table.language') }}</th>
            <th scope="col" class="bd-drafts-col-edited">{{ t('drafts.table.edited') }}</th>
            <th scope="col" class="bd-drafts-col-action"><span class="bd-sr">{{ t('drafts.table.action') }}</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.key">
            <td><span :class="['bd-badge', `bd-badge-${row.state}`]">{{ stateLabel(row.state) }}</span></td>
            <td>
              <span class="bd-drafts-article">
                <span class="bd-drafts-article-title">{{ row.title }}</span>
                <span class="bd-meta bd-drafts-article-meta">{{ [row.path, row.author].filter(Boolean).join(' · ') }}</span>
              </span>
            </td>
            <td><BdCategoryTag v-if="row.category" :category="row.category" /></td>
            <td class="bd-meta bd-drafts-muted">{{ row.language }}</td>
            <td class="bd-meta bd-drafts-muted"><time :datetime="row.editedAt">{{ row.edited }}</time></td>
            <td class="bd-drafts-action">
              <NuxtLink :to="row.to" class="bd-chip bd-drafts-review" :aria-label="t('drafts.reviewLabel', { title: row.title })">
                {{ t('drafts.review') }} <span aria-hidden="true">→</span>
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>

      <ul class="bd-drafts-list">
        <li v-for="row in rows" :key="row.key">
          <NuxtLink :to="row.to" class="bd-card bd-drafts-card" :aria-label="t('drafts.reviewLabel', { title: row.title })">
            <span class="bd-drafts-card-row">
              <span :class="['bd-badge', `bd-badge-${row.state}`]">{{ stateLabel(row.state) }}</span>
              <span class="bd-meta bd-drafts-muted">{{ row.language }}</span>
            </span>
            <span class="bd-drafts-card-title">{{ row.title }}</span>
            <span class="bd-drafts-card-row">
              <BdCategoryTag v-if="row.category" :category="row.category" />
              <time class="bd-meta bd-drafts-muted" :datetime="row.editedAt">{{ row.edited }}</time>
            </span>
            <span class="bd-meta bd-drafts-card-cta" aria-hidden="true">{{ t('drafts.review') }} →</span>
          </NuxtLink>
        </li>
      </ul>
    </template>

    <div v-else class="bd-drafts-empty">
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false"><circle cx="28" cy="28" r="22" /><path d="M18 28 L25 35 L39 21" stroke-linecap="square" /></svg>
      <h2 class="bd-drafts-empty-title">{{ t('drafts.empty.title') }}</h2>
      <p class="bd-drafts-empty-text">{{ drafts.length ? t('drafts.empty.filtered') : t('drafts.empty.text') }}</p>
    </div>
  </div>
</template>
