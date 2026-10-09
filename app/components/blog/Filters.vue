<script setup lang="ts">
import type { BlogFilters, Category, StrapiTagRef } from '~/interfaces'
import { CATEGORIES, categoryColor } from '~/helpers/categories'
import { blogLocation, hasActiveFilters } from '~/helpers/blog'
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
  content: [enabled: boolean]
  remove: [filter: ActiveFilter['id']]
  clear: []
}>()

const search = defineModel<string>('search', { required: true })

const { t } = useI18n()
const { localizePath } = useLocaleUtils()

const { isStatic } = useStaticSite()

const blogBase = computed<string>(() => localizePath('/blog'))

// One filter per URL: a chip replaces the other filter and goes back to the first page
function filterLocation(patch: Pick<BlogFilters, 'category' | 'tag'>): ReturnType<typeof blogLocation> {
  return blogLocation({ ...props.filters, ...patch, page: 1 }, blogBase.value)
}

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
  <section class="myc-blog-filters" :aria-label="t('blog.filters')">
    <div v-if="!isStatic" class="myc-blog-search">
      <label for="myc-blog-q" class="myc-sr">{{ t('blog.search.label') }}</label>
      <span class="myc-blog-search-prompt" aria-hidden="true">→</span>
      <input
        id="myc-blog-q"
        v-model="search"
        type="search"
        class="myc-blog-search-input"
        :placeholder="t('blog.search.placeholder')"
        autocomplete="off"
        enterkeyhint="search"
      >
      <span class="myc-meta myc-blog-search-count" role="status">{{ resultLabel }}</span>
      <p class="myc-meta myc-blog-hint">{{ filters.content ? t('blog.search.hintContent') : t('blog.search.hint') }}</p>
      <label class="myc-blog-content-toggle">
        <input
          type="checkbox"
          :checked="filters.content === true"
          @change="emit('content', ($event.target as HTMLInputElement).checked)"
        >
        {{ t('blog.search.content') }}
      </label>
    </div>

    <div class="myc-blog-filter-row">
      <span class="myc-eyebrow myc-blog-filter-label">{{ t('blog.categories') }}</span>
      <div class="myc-blog-chips" role="group" :aria-label="t('blog.filterCategory')">
        <NuxtLink
          v-for="chip in categoryChips"
          :key="chip.id ?? 'all'"
          :to="filterLocation({ category: chip.id, tag: undefined })"
          class="myc-chip"
          :aria-current="filters.category === chip.id && !filters.tag ? 'page' : undefined"
        >
          <span class="myc-latest-dot" :style="{ background: chip.color }" aria-hidden="true" />{{ chip.label }}<span class="myc-latest-count">{{ chip.count }}</span>
        </NuxtLink>
      </div>
    </div>

    <div v-if="tags.length" class="myc-blog-filter-row">
      <span class="myc-eyebrow myc-blog-filter-label">{{ t('blog.tags') }}</span>
      <div class="myc-blog-chips" role="group" :aria-label="t('blog.filterTag')">
        <NuxtLink
          v-for="tag in tags"
          :key="tag.slug"
          :to="filterLocation({ category: undefined, tag: filters.tag === tag.slug ? undefined : tag.slug })"
          class="myc-chip myc-blog-tag"
          :aria-current="filters.tag === tag.slug ? 'page' : undefined"
        >
          #{{ tag.name }}
        </NuxtLink>
      </div>
    </div>

    <div v-if="hasActiveFilters(filters)" class="myc-meta myc-blog-active">
      <span class="myc-blog-active-label">{{ t('blog.filteringBy') }}</span>
      <template v-if="isStatic">
        <NuxtLink
          v-for="filter in activeFilters"
          :key="filter.id"
          :to="blogBase"
          class="myc-chip myc-blog-active-chip"
          :aria-label="t('blog.removeFilter', { label: filter.label })"
        >
          {{ filter.label }} <span aria-hidden="true">✕</span>
        </NuxtLink>
      </template>
      <template v-else>
        <button
          v-for="filter in activeFilters"
          :key="filter.id"
          type="button"
          class="myc-chip myc-blog-active-chip"
          :aria-label="t('blog.removeFilter', { label: filter.label })"
          @click="emit('remove', filter.id)"
        >
          {{ filter.label }} <span aria-hidden="true">✕</span>
        </button>
        <button type="button" class="myc-blog-textbtn" @click="emit('clear')">{{ t('blog.clearFilters') }}</button>
      </template>
    </div>
  </section>
</template>
