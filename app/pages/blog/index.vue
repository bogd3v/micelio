<script setup lang="ts">
import { layout } from '#micelio/theme'
import { Locale } from '~/interfaces'
import type { BlogFilters, BlogSort, BlogView, Category, PostListItem, TagCount } from '~/interfaces'
import { BLOG_SORTS, blogLocation, blogPageSize, blogPath, hasActiveFilters, parseBlogRoute, parseSort, searchTerm } from '~/helpers/blog'
import { isCategory } from '~/helpers/categories'
import { feedPath } from '~/helpers/feed'
import { padCount } from '~/helpers/search'
import { popularTags as pickPopularTags } from '~/helpers/tags'
import { pageTitle } from '~/helpers/site'

definePageMeta({ key: 'blog-list' })

const RECENT_SIZE = 4
const SEARCH_DEBOUNCE_MS = 300
const POPULAR_TAGS = 8
const VIEWS: BlogView[] = ['grid', 'log']
// The list variant always renders rows: it ignores the view and hides its switch (ADR 0005, section 5)
const viewSwitch = layout.postList !== 'list'

const { locale, t } = useI18n()
const route = useRoute()
const router = useRouter()
const { localizePath } = useLocaleUtils()
const { setAlternates } = useLocaleAlternates()
const { fetchPosts, fetchCategories, fetchTags } = useStrapi()
const { siteUrl } = useSiteUrl()
const defaultOgImage = useDefaultOgImage()
const site = useSite()
const config = useRuntimeConfig()
const fediverseOn = useModule('fediverse')

// An unknown category, or a page that has its own URL (/blog), is a 404
const pathCategory = route.params.category
const pathPage = Number(route.params.page ?? 2)
if ((pathCategory !== undefined && !isCategory(String(pathCategory).toLowerCase())) || pathPage < 2) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found' })
}

// Without the switch the view is not part of the URL
const filters = computed<BlogFilters>(() => ({
  ...parseBlogRoute(route.params, route.query),
  ...(viewSwitch ? {} : { view: undefined }),
}))
const blogBase = computed<string>(() => localizePath('/blog'))
const canonicalUrl = computed<string>(() => `${siteUrl.value}${blogPath(filters.value, blogBase.value)}`)
const currentLocale = computed<Locale>(() => locale.value as Locale)
const view = computed<BlogView>(() => viewSwitch ? (filters.value.view ?? 'grid') : 'grid')
const pageSize = computed<number>(() => blogPageSize(view.value))
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
const federated = computed<boolean>(() => fediverseOn.value && locale.value === config.public.fediverseLocale)
// The fediverse ranking needs the fediverse module
const sortOptions = computed<BlogSort[]>(() => BLOG_SORTS.filter(option => option !== 'fediverse' || fediverseOn.value))
const eyebrow = computed<string>(() => t('blog.eyebrow', { count: padCount(total.value) }, total.value))

const applySearch = useDebounceFn(() => {
  const search = searchTerm(searchInput.value)
  if (search !== filters.value.search) navigate({ search, page: 1 }, true)
}, SEARCH_DEBOUNCE_MS)

function navigate(patch: Partial<BlogFilters>, replace = false): void {
  // One filter per path: choosing a category drops the tag and the other way round
  const next: BlogFilters = { ...filters.value, ...patch }
  const location = blogLocation(next, blogBase.value)
  if (replace) router.replace(location)
  else router.push(location)
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

// Page n of one language is not page n of the other: the alternates point at the first page
watch(() => route.path, () => {
  setAlternates(Object.fromEntries(Object.values(Locale).map(code => [
    code,
    blogPath({ ...filters.value, page: 1 }, localizePath('/blog', code)),
  ])))
}, { immediate: true })

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
  ogImage: () => defaultOgImage.value,
  ogImageAlt: () => `${site.value.name} — Blog`,
  twitterCard: 'summary_large_image',
  twitterImage: () => defaultOgImage.value,
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
        <div v-if="viewSwitch" class="bd-seg-group bd-blog-views" role="group" :aria-label="t('blog.view.label')">
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
            <option v-for="option in sortOptions" :key="option" :value="option">{{ t(`blog.sort.${option}`) }}</option>
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
      @content="toggleContent"
      @remove="removeFilter"
      @clear="clearFilters"
    />

    <div class="bd-blog-body">
      <div id="posts" class="bd-blog-main" :aria-busy="status === 'pending'">
        <RegionPostList v-if="posts.length" :posts="posts" :view="view" :federated="federated" :highlight="filters.search" />

        <ThemeEmptyState v-else class="bd-latest-empty bd-blog-empty">
          <h2 class="bd-latest-empty-title">{{ t("blog.noPosts") }}</h2>
          <p class="bd-meta bd-home-eyebrow bd-latest-empty-note">
            {{ filtered ? t("blog.tryAdjustingFilters") : t("blog.noArticlesYet") }}
          </p>
          <button v-if="filtered" type="button" class="bd-chip" @click="clearFilters">
            {{ t("blog.clearFilters") }} <span aria-hidden="true">→</span>
          </button>
        </ThemeEmptyState>

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
