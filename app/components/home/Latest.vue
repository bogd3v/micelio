<script setup lang="ts">
import type { Category, Locale } from '~/interfaces'
import { CATEGORIES, categoryColor } from '~/helpers/categories'
import { padCount } from '~/helpers/search'
import { blogPath } from '~/helpers/blog'

interface TopicFilter {
  id: Category | 'all'
  label: string
  color: string
  count: string
}

const LATEST_SIZE = 5

const props = defineProps<{
  /** Slug of the post shown above as the featured card: it keeps its transition names there */
  featuredSlug?: string
  total: number
  counts: Partial<Record<Category, number>>
}>()

const { locale, t } = useI18n()
const themeMessage = useThemeMessage()
const { fetchPosts } = useStrapi()
const { localizePath } = useLocaleUtils()
const toPostCard = usePostCard()
const { isStatic } = useStaticSite()

const selected = ref<Category | undefined>()

const { data: postsResult, status } = fetchPosts({ pageSize: LATEST_SIZE, locale: locale.value as Locale, category: selected })

const results = useSettledData(postsResult, status)

const posts = computed(() => results.value?.data ?? [])
const shownTotal = computed<number>(() => results.value?.pagination.total ?? posts.value.length)
const filters = computed<TopicFilter[]>(() => [
  { id: 'all', label: t('home.latest.all'), color: 'var(--ink-muted)', count: padCount(props.total) },
  ...CATEGORIES.map(category => ({
    id: category,
    label: t(`myc.categoryShort.${category}`),
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
  <section id="latest" class="myc-home-section myc-reveal" aria-labelledby="latest-title">
    <div class="myc-home-head">
      <div class="myc-home-heading">
        <p class="myc-eyebrow myc-home-eyebrow" aria-live="polite">{{ eyebrow }}</p>
        <h2 id="latest-title" class="myc-home-title myc-stretch">{{ t('home.latest.title') }}</h2>
      </div>
      <div class="myc-latest-filters" role="group" :aria-label="t('home.latest.filters')">
        <template v-for="filter in filters" :key="filter.id">
          <NuxtLink
            v-if="isStatic"
            :to="filter.id === 'all' ? localizePath('/blog') : blogPath({ category: filter.id, page: 1 }, localizePath('/blog'))"
            class="myc-chip"
          >
            <span class="myc-latest-dot" :style="{ background: filter.color }" aria-hidden="true" />{{ filter.label }}<span class="myc-latest-count">{{ filter.count }}</span>
          </NuxtLink>
          <button
            v-else
            type="button"
            class="myc-chip"
            :aria-pressed="(selected ?? 'all') === filter.id ? 'true' : 'false'"
            @click="select(filter.id)"
          >
            <span class="myc-latest-dot" :style="{ background: filter.color }" aria-hidden="true" />{{ filter.label }}<span class="myc-latest-count">{{ filter.count }}</span>
          </button>
        </template>
      </div>
    </div>

    <div class="myc-latest-grid" :aria-busy="status === 'pending'">
      <MycPostCard v-for="post in posts" :key="post.id" v-bind="toPostCard(post)" :transition="post.slug !== featuredSlug" />
      <NuxtLink v-if="!selected && posts.length" :to="localizePath('/blog')" class="myc-latest-archive">
        <span class="myc-eyebrow myc-home-eyebrow">{{ t('home.latest.archive') }}</span>
        <span class="myc-latest-archive-title myc-wide">{{ t('home.latest.archiveTitle') }} <span class="myc-card-arrow" aria-hidden="true">→</span></span>
        <span class="myc-meta myc-home-eyebrow">{{ t('home.latest.archiveMeta') }}</span>
      </NuxtLink>
      <ThemeEmptyState v-if="!posts.length" class="myc-latest-empty" :style="{ '--empty-accent': emptyColor }">
        <h3 class="myc-latest-empty-title">{{ emptyTitle }}</h3>
        <p class="myc-meta myc-home-eyebrow myc-latest-empty-note">{{ themeMessage('latest.emptyNote', 'home.latest.emptyNote') }}</p>
        <button v-if="selected" type="button" class="myc-chip" @click="select('all')">
          {{ t('home.latest.showAll') }} <span aria-hidden="true">→</span>
        </button>
      </ThemeEmptyState>
    </div>
  </section>
</template>
