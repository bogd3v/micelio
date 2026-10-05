<script setup lang="ts">
import type { Category, Locale } from '~/interfaces'
import { CATEGORIES, categoryColor } from '~/helpers/categories'
import { padCount } from '~/helpers/search'

interface TopicFilter {
  id: Category | 'all'
  label: string
  color: string
  count: string
}

const LATEST_SIZE = 5

const props = defineProps<{
  total: number
  counts: Partial<Record<Category, number>>
}>()

const { locale, t } = useI18n()
const { fetchPosts } = useStrapi()
const { localizePath } = useLocaleUtils()
const toPostCard = usePostCard()

const selected = ref<Category | undefined>()

const { data: postsResult, status } = fetchPosts({ pageSize: LATEST_SIZE, locale: locale.value as Locale, category: selected })

const results = useSettledData(postsResult, status)

const posts = computed(() => results.value?.data ?? [])
const shownTotal = computed<number>(() => results.value?.pagination.total ?? posts.value.length)
const filters = computed<TopicFilter[]>(() => [
  { id: 'all', label: t('home.latest.all'), color: 'var(--ink-muted)', count: padCount(props.total) },
  ...CATEGORIES.map(category => ({
    id: category,
    label: t(`bd.categoryShort.${category}`),
    color: categoryColor(category),
    count: padCount(props.counts[category] ?? 0),
  })),
])
const eyebrow = computed<string>(() => t('home.latest.eyebrow', { count: padCount(shownTotal.value) }, shownTotal.value))
const emptyTitle = computed<string>(() => t(`home.latest.empty.${selected.value ?? 'all'}`))
const emptyColor = computed<string>(() =>
  selected.value ? categoryColor(selected.value) : 'var(--ink-muted)',
)

function select(id: TopicFilter['id']): void {
  selected.value = id === 'all' ? undefined : id
}
</script>

<template>
  <section id="latest" class="bd-home-section bd-reveal" aria-labelledby="latest-title">
    <div class="bd-home-head">
      <div class="bd-home-heading">
        <p class="bd-eyebrow bd-home-eyebrow" aria-live="polite">{{ eyebrow }}</p>
        <h2 id="latest-title" class="bd-home-title bd-stretch">{{ t('home.latest.title') }}</h2>
      </div>
      <div class="bd-latest-filters" role="group" :aria-label="t('home.latest.filters')">
        <button
          v-for="filter in filters"
          :key="filter.id"
          type="button"
          class="bd-chip"
          :aria-pressed="(selected ?? 'all') === filter.id ? 'true' : 'false'"
          @click="select(filter.id)"
        >
          <span class="bd-latest-dot" :style="{ background: filter.color }" aria-hidden="true" />{{ filter.label }}<span class="bd-latest-count">{{ filter.count }}</span>
        </button>
      </div>
    </div>

    <div class="bd-latest-grid" :aria-busy="status === 'pending'">
      <BdPostCard v-for="post in posts" :key="post.id" v-bind="toPostCard(post)" />
      <NuxtLink v-if="!selected && posts.length" :to="localizePath('/blog')" class="bd-latest-archive">
        <span class="bd-eyebrow bd-home-eyebrow">{{ t('home.latest.archive') }}</span>
        <span class="bd-latest-archive-title bd-wide">{{ t('home.latest.archiveTitle') }} <span class="bd-card-arrow" aria-hidden="true">→</span></span>
        <span class="bd-meta bd-home-eyebrow">{{ t('home.latest.archiveMeta') }}</span>
      </NuxtLink>
      <ThemeEmptyState v-if="!posts.length" class="bd-latest-empty" :style="{ '--empty-accent': emptyColor }">
        <h3 class="bd-latest-empty-title">{{ emptyTitle }}</h3>
        <p class="bd-meta bd-home-eyebrow bd-latest-empty-note">{{ t('home.latest.emptyNote') }}</p>
        <button v-if="selected" type="button" class="bd-chip" @click="select('all')">
          {{ t('home.latest.showAll') }} <span aria-hidden="true">→</span>
        </button>
      </ThemeEmptyState>
    </div>
  </section>
</template>
