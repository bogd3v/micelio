<script setup lang="ts">
import { layout } from '#micelio/theme'
import { Locale } from '~/interfaces'
import type { BlogFilters, BlogSort, BlogView, Category, PostListItem, TagCount } from '~/interfaces'
import { BLOG_SORTS, blogLocation, blogPageSize, blogPath, hasActiveFilters, isBlogRouteValid, parseBlogRoute, parseSort, searchTerm } from '~/helpers/blog'
import { isCategory } from '~/helpers/categories'
import { feedPath } from '~/helpers/feed'
import { padCount } from '~/helpers/search'
import { popularTags as pickPopularTags } from '~/helpers/tags'
import { pageTitle } from '~/helpers/site'

// An unknown category, or a page that has its own URL (/blog), is a 404 on every navigation
definePageMeta({ key: 'blog-list', validate: route => isBlogRouteValid(route.params) })

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
// View, sort and search only exist in dynamic sites (ADR 0006, section 7)
const { isStatic } = useStaticSite()

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

// Page n of one language is not page n of the other: the switcher goes to the first page and pages above it have no hreflang
watch(() => route.path, () => {
  setAlternates(Object.fromEntries(Object.values(Locale).map(code => [
    code,
    blogPath({ ...filters.value, page: 1 }, localizePath('/blog', code)),
  ])), { hreflang: filters.value.page === 1 })
}, { immediate: true })

watch(() => filters.value.page, () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document.getElementById('posts')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' })
})

useHead(() => ({
  link: [
    { rel: 'canonical' as const, href: canonicalUrl.value },
    ...(filters.value.category
      ? [{
          rel: 'alternate' as const,
          type: 'application/rss+xml',
          title: t('blog.feeds.title', { site: site.value.name, category: t(`myc.categories.${filters.value.category}`) }),
          href: `${siteUrl.value}${feedPath(locale.value, filters.value.category)}`,
        }]
      : []),
  ],
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
  <div class="myc-blog">
    <header class="myc-blog-head">
      <p class="myc-eyebrow myc-home-eyebrow">{{ eyebrow }}</p>
      <h1 class="myc-blog-title myc-wide">{{ t("nav.blog") }}</h1>
      <p class="myc-blog-lead">{{ t("blog.exploreArticles") }}</p>
      <div v-if="!isStatic" class="myc-blog-controls">
        <div v-if="viewSwitch" class="myc-seg-group myc-blog-views" role="group" :aria-label="t('blog.view.label')">
          <button
            v-for="option in VIEWS"
            :key="option"
            type="button"
            class="myc-seg"
            :aria-pressed="view === option ? 'true' : 'false'"
            @click="selectView(option)"
          >
            {{ t(`blog.view.${option}`) }}
          </button>
        </div>
        <div class="myc-blog-sort">
          <label for="myc-blog-sort" class="myc-eyebrow myc-home-eyebrow">{{ t("blog.sort.label") }}</label>
          <select id="myc-blog-sort" class="myc-select" :value="sort" @change="selectSort">
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

    <div class="myc-blog-body">
      <div id="posts" class="myc-blog-main" :aria-busy="status === 'pending'">
        <RegionPostList v-if="posts.length" :posts="posts" :view="view" :federated="federated" :highlight="filters.search" />

        <ThemeEmptyState v-else class="myc-latest-empty myc-blog-empty">
          <h2 class="myc-latest-empty-title">{{ t("blog.noPosts") }}</h2>
          <p class="myc-meta myc-home-eyebrow myc-latest-empty-note">
            {{ filtered ? t("blog.tryAdjustingFilters") : t("blog.noArticlesYet") }}
          </p>
          <template v-if="filtered">
            <NuxtLink v-if="isStatic" :to="blogBase" class="myc-chip">
              {{ t("blog.clearFilters") }} <span aria-hidden="true">→</span>
            </NuxtLink>
            <button v-else type="button" class="myc-chip" @click="clearFilters">
              {{ t("blog.clearFilters") }} <span aria-hidden="true">→</span>
            </button>
          </template>
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
