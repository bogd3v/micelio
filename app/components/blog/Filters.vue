<script setup lang="ts">
import type { BlogFilters, Category, StrapiTagRef } from '~/interfaces'
import { CATEGORIES, categoryColor } from '~/helpers/categories'
import { hasActiveFilters } from '~/helpers/blog'
import { tagLabel } from '~/helpers/tags'
import { padCount } from '~/helpers/search'

interface ActiveFilter {
  id: 'category' | 'tag' | 'search'
  label: string
}

const props = defineProps<{
  filters: BlogFilters
  total: number
  counts: Partial<Record<Category, number>>
  tags: StrapiTagRef[]
  resultCount?: number
}>()

const emit = defineEmits<{
  category: [category: Category | undefined]
  tag: [tag: string | undefined]
  content: [enabled: boolean]
  remove: [filter: ActiveFilter['id']]
  clear: []
}>()

const search = defineModel<string>('search', { required: true })

const { t } = useI18n()

const categoryChips = computed<{ id: Category | undefined, label: string, color: string, count: string }[]>(() => [
  { id: undefined, label: t('blog.all'), color: 'var(--ink-muted)', count: padCount(props.total) },
  ...CATEGORIES.map(category => ({
    id: category,
    label: t(`bd.categoryShort.${category}`),
    color: categoryColor(category),
    count: padCount(props.counts[category] ?? 0),
  })),
])
const activeFilters = computed<ActiveFilter[]>(() => {
  const active: ActiveFilter[] = []
  if (props.filters.category) active.push({ id: 'category', label: t(`bd.categoryShort.${props.filters.category}`) })
  if (props.filters.tag) active.push({ id: 'tag', label: `#${tagLabel(props.tags, props.filters.tag)}` })
  if (props.filters.search) active.push({ id: 'search', label: `«${props.filters.search}»` })
  return active
})
const resultLabel = computed<string>(() =>
  props.resultCount === undefined ? '' : t('blog.search.results', { count: padCount(props.resultCount) }, props.resultCount),
)
</script>

<template>
  <section class="bd-blog-filters" :aria-label="t('blog.filters')">
    <div class="bd-blog-search">
      <label for="bd-blog-q" class="bd-sr">{{ t('blog.search.label') }}</label>
      <span class="bd-blog-search-prompt" aria-hidden="true">→</span>
      <input
        id="bd-blog-q"
        v-model="search"
        type="search"
        class="bd-blog-search-input"
        :placeholder="t('blog.search.placeholder')"
        autocomplete="off"
        enterkeyhint="search"
      >
      <span class="bd-meta bd-blog-search-count" role="status">{{ resultLabel }}</span>
      <p class="bd-meta bd-blog-hint">{{ filters.content ? t('blog.search.hintContent') : t('blog.search.hint') }}</p>
      <label class="bd-blog-content-toggle">
        <input
          type="checkbox"
          :checked="filters.content === true"
          @change="emit('content', ($event.target as HTMLInputElement).checked)"
        >
        {{ t('blog.search.content') }}
      </label>
    </div>

    <div class="bd-blog-filter-row">
      <span class="bd-eyebrow bd-blog-filter-label">{{ t('blog.categories') }}</span>
      <div class="bd-blog-chips" role="group" :aria-label="t('blog.filterCategory')">
        <button
          v-for="chip in categoryChips"
          :key="chip.id ?? 'all'"
          type="button"
          class="bd-chip"
          :aria-pressed="filters.category === chip.id ? 'true' : 'false'"
          @click="emit('category', chip.id)"
        >
          <span class="bd-latest-dot" :style="{ background: chip.color }" aria-hidden="true" />{{ chip.label }}<span class="bd-latest-count">{{ chip.count }}</span>
        </button>
      </div>
    </div>

    <div v-if="tags.length" class="bd-blog-filter-row">
      <span class="bd-eyebrow bd-blog-filter-label">{{ t('blog.tags') }}</span>
      <div class="bd-blog-chips" role="group" :aria-label="t('blog.filterTag')">
        <button
          v-for="tag in tags"
          :key="tag.slug"
          type="button"
          class="bd-chip bd-blog-tag"
          :aria-pressed="filters.tag === tag.slug ? 'true' : 'false'"
          @click="emit('tag', filters.tag === tag.slug ? undefined : tag.slug)"
        >
          #{{ tag.name }}
        </button>
      </div>
    </div>

    <div v-if="hasActiveFilters(filters)" class="bd-meta bd-blog-active">
      <span class="bd-blog-active-label">{{ t('blog.filteringBy') }}</span>
      <button
        v-for="filter in activeFilters"
        :key="filter.id"
        type="button"
        class="bd-chip bd-blog-active-chip"
        :aria-label="t('blog.removeFilter', { label: filter.label })"
        @click="emit('remove', filter.id)"
      >
        {{ filter.label }} <span aria-hidden="true">✕</span>
      </button>
      <button type="button" class="bd-blog-textbtn" @click="emit('clear')">{{ t('blog.clearFilters') }}</button>
    </div>
  </section>
</template>
