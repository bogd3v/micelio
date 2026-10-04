<script setup lang="ts">
import type { BlogFilters, BlogSort, BlogView, Category, Locale, PostListItem, TagCount } from '~/interfaces'
import { BLOG_SORTS, blogPageSize, blogQuery, hasActiveFilters, parseBlogQuery, parseSort, searchTerm } from '~/helpers/blog'
import { isCategory } from '~/helpers/categories'
import { feedPath } from '~/helpers/feed'
import { padCount } from '~/helpers/search'
import { popularTags as pickPopularTags } from '~/helpers/tags'
import { pageTitle } from '~/helpers/site'

const RECENT_SIZE = 4
const SEARCH_DEBOUNCE_MS = 300
const POPULAR_TAGS = 8
const VIEWS: BlogView[] = ['grid', 'log']

const { locale, t } = useI18n()
const route = useRoute()
const router = useRouter()
const { fetchPosts, fetchCategories, fetchTags } = useStrapi()
const { canonicalUrl } = useCanonicalUrl('/blog')
const { siteUrl } = useSiteUrl()
const site = useSite()
const config = useRuntimeConfig()
const toPostCard = usePostCard()

const filters = computed<BlogFilters>(() => parseBlogQuery(route.query))
const currentLocale = computed<Locale>(() => locale.value as Locale)
const view = computed<BlogView>(() => filters.value.view ?? 'grid')
const pageSize = computed<number>(() => blogPageSize(filters.value.view))
const sort = computed<BlogSort>(() => filters.value.sort ?? 'recent')

const { data: postsResult, status } = fetchPosts({
  page: computed(() => filters.value.page),
  pageSize,
  locale: currentLocale,
  category: computed(() => filters.value.category),
  tag: computed(() => filters.value.tag),
  search: computed(() => filters.value.search),
  sort: computed(() => filters.value.sort),
  content: computed(() => filters.value.content),
})
const { data: recentResult } = fetchPosts({ pageSize: RECENT_SIZE, locale: currentLocale })
const { data: categories } = fetchCategories(locale.value as Locale)
const { data: tags } = fetchTags(locale.value as Locale)

const results = useSettledData(postsResult, status)
const searchInput = ref<string>(filters.value.search ?? '')

const posts = computed<PostListItem[]>(() => results.value?.data ?? [])
const totalPages = computed<number>(() => results.value?.pagination.pageCount ?? 1)
const recentPosts = computed<PostListItem[]>(() => recentResult.value?.data ?? [])
const total = computed<number>(() => recentResult.value?.pagination.total ?? 0)
const counts = computed<Partial<Record<Category, number>>>(() =>
  Object.fromEntries(
    (categories.value ?? [])
      .filter(category => isCategory(category.slug))
      .map(category => [category.slug, category.count]),
  ),
)
const popularTags = computed<TagCount[]>(() => pickPopularTags(tags.value ?? [], POPULAR_TAGS, filters.value.tag))
const resultCount = computed<number | undefined>(() =>
  filters.value.search ? (results.value?.pagination.total ?? 0) : undefined,
)
const filtered = computed<boolean>(() => hasActiveFilters(filters.value))
const federated = computed<boolean>(() => locale.value === config.public.fediverseLocale)
const eyebrow = computed<string>(() => t('blog.eyebrow', { count: padCount(total.value) }, total.value))

const applySearch = useDebounceFn(() => {
  const search = searchTerm(searchInput.value)
  if (search !== filters.value.search) navigate({ search, page: 1 }, true)
}, SEARCH_DEBOUNCE_MS)

function navigate(patch: Partial<BlogFilters>, replace = false): void {
  const query = blogQuery({ ...filters.value, ...patch })
  if (replace) router.replace({ query })
  else router.push({ query })
}

function selectView(next: BlogView): void {
  if (next === view.value) return
  navigate({ view: next === 'log' ? 'log' : undefined, page: 1 })
}

function selectSort(event: Event): void {
  const next = parseSort((event.target as HTMLSelectElement).value) ?? 'recent'
  if (next === sort.value) return
  navigate({ sort: next === 'recent' ? undefined : next, page: 1 })
}

function toggleContent(enabled: boolean): void {
  navigate({ content: enabled || undefined, page: 1 })
}

function selectCategory(category: Category | undefined): void {
  navigate({ category, page: 1 })
}

function selectTag(tag: string | undefined): void {
  navigate({ tag, page: 1 })
}

function removeFilter(filter: 'category' | 'tag' | 'search'): void {
  if (filter === 'search') searchInput.value = ''
  navigate({ [filter]: undefined, page: 1 })
}

function clearFilters(): void {
  searchInput.value = ''
  navigate({ category: undefined, tag: undefined, search: undefined, page: 1 })
}

watch(searchInput, () => applySearch())

watch(() => filters.value.search, (search) => {
  if (search !== searchTerm(searchInput.value)) searchInput.value = search ?? ''
})

watch(() => filters.value.page, () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document.getElementById('posts')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' })
})

useHead(() => ({
  link: filters.value.category
    ? [{
        rel: 'alternate',
        type: 'application/rss+xml',
        title: t('blog.feeds.title', { site: site.value.name, category: t(`bd.categories.${filters.value.category}`) }),
        href: `${siteUrl.value}${feedPath(locale.value, filters.value.category)}`,
      }]
    : [],
}))

useSeoMeta({
  title: () => pageTitle('Blog', site.value.name),
  ogTitle: () => pageTitle('Blog', site.value.name),
  description:
    'Browse all articles on AI, software development, Linux, DevOps, and more. Find tutorials, tips, and insights from my tech journey.',
  ogDescription:
    'Browse all articles on AI, software development, Linux, DevOps, and more. Find tutorials, tips, and insights from my tech journey.',
  ogUrl: () => canonicalUrl.value,
  ogImage: () => `${siteUrl.value}/og-image.png`,
  ogImageAlt: () => `${site.value.name} — Blog`,
  twitterCard: 'summary_large_image',
  twitterImage: () => `${siteUrl.value}/og-image.png`,
  twitterTitle: () => pageTitle('Blog', site.value.name),
  twitterDescription:
    'Browse all articles on AI, software development, Linux, DevOps, and more.',
})
</script>

<template>
  <div class="bd-blog">
    <header class="bd-blog-head">
      <p class="bd-eyebrow bd-home-eyebrow">{{ eyebrow }}</p>
      <h1 class="bd-blog-title bd-wide">{{ t("nav.blog") }}</h1>
      <p class="bd-blog-lead">{{ t("blog.exploreArticles") }}</p>
      <div class="bd-blog-controls">
        <div class="bd-seg-group bd-blog-views" role="group" :aria-label="t('blog.view.label')">
          <button
            v-for="option in VIEWS"
            :key="option"
            type="button"
            class="bd-seg"
            :aria-pressed="view === option ? 'true' : 'false'"
            @click="selectView(option)"
          >
            {{ t(`blog.view.${option}`) }}
          </button>
        </div>
        <div class="bd-blog-sort">
          <label for="bd-blog-sort" class="bd-eyebrow bd-home-eyebrow">{{ t("blog.sort.label") }}</label>
          <select id="bd-blog-sort" class="bd-select" :value="sort" @change="selectSort">
            <option v-for="option in BLOG_SORTS" :key="option" :value="option">{{ t(`blog.sort.${option}`) }}</option>
          </select>
        </div>
      </div>
    </header>

    <BlogFilters
      v-model:search="searchInput"
      :filters="filters"
      :total="total"
      :counts="counts"
      :tags="popularTags"
      :result-count="resultCount"
      @category="selectCategory"
      @tag="selectTag"
      @content="toggleContent"
      @remove="removeFilter"
      @clear="clearFilters"
    />

    <div class="bd-blog-body">
      <div id="posts" class="bd-blog-main" :aria-busy="status === 'pending'">
        <h2 v-if="posts.length && view !== 'log'" class="bd-sr">{{ t("blog.listTitle") }}</h2>
        <BlogLog v-if="posts.length && view === 'log'" :posts="posts" :federated="federated" :highlight="filters.search" />

        <div v-else-if="posts.length" class="bd-blog-grid">
          <BdPostCard
            v-for="(post, index) in posts"
            :key="post.id"
            v-bind="toPostCard(post)"
            :highlight="filters.search"
            :priority="index === 0"
          />
        </div>

        <div v-else class="bd-latest-empty bd-blog-empty">
          <svg width="120" height="60" viewBox="0 0 120 60" aria-hidden="true" focusable="false">
            <path d="M0 44 Q60 58 120 44" fill="none" stroke="var(--line-strong)" stroke-width="1" />
            <g transform="translate(60 51)">
              <g class="bd-perch">
                <path d="M-8 -4 Q-9 -11 -2 -12 Q1 -17 6 -15 L7 -14 Q8 -6 2 -2 L-3 -1 L-11 4 Z" fill="var(--ink-muted)" />
                <path d="M6 -15 L12 -13.5 L7 -12.5 Z" fill="var(--mirla)" />
              </g>
            </g>
          </svg>
          <h2 class="bd-latest-empty-title">{{ t("blog.noPosts") }}</h2>
          <p class="bd-meta bd-home-eyebrow bd-latest-empty-note">
            {{ filtered ? t("blog.tryAdjustingFilters") : t("blog.noArticlesYet") }}
          </p>
          <button v-if="filtered" type="button" class="bd-chip" @click="clearFilters">
            {{ t("blog.clearFilters") }} <span aria-hidden="true">→</span>
          </button>
        </div>

        <BlogPagination
          v-if="posts.length"
          :filters="filters"
          :total-pages="totalPages"
          :page-size="pageSize"
        />
      </div>

      <BlogSidebar :recent-posts="recentPosts" :category="filters.category" />
    </div>
  </div>
</template>
