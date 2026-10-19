<script setup lang="ts">
import { layout } from '#micelio/theme'
import { Locale } from '~/interfaces'
import type { BlogFilters, BlogSort, BlogView, CategoryEntry, PostListItem, TagCount } from '~/interfaces'
import { BLOG_SORTS, blogLocation, blogPageSize, blogPath, hasActiveFilters, isBlogRouteValid, localesWithCategory, parseBlogRoute, parseSort, searchTerm } from '~/helpers/blog'
import { feedPath } from '~/helpers/feed'
import { padCount } from '~/helpers/search'
import { popularTags as pickPopularTags } from '~/helpers/tags'
import { pageTitle } from '~/helpers/site'

// A category that is not a slug, or a page that has its own URL (/blog), is a 404 on every navigation; a slug the CMS does not have is a 404 once the list has loaded
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
const { fetchCategories, fetchPosts, fetchTags } = useStrapi()
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
const { failed: categoriesFailed, has: hasCategory, labelOf, loaded: categoriesLoaded } = useCategories()
const { data: tags } = fetchTags(locale.value as Locale)
// One list per language, under the keys `useCategories` already uses, so the current one is not fetched twice
const categoryLists = Object.fromEntries(Object.values(Locale).map(code => [code, fetchCategories(code).data])) as Record<Locale, Ref<CategoryEntry[]>>
const hasPage = computed<Locale[]>(() => localesWithCategory(filters.value.category, Object.fromEntries(Object.entries(categoryLists).map(([code, list]) => [code, list.value]))))

const results = useSettledData(postsResult, status)
const searchInput = ref<string>(filters.value.search ?? '')

const posts = computed<PostListItem[]>(() => results.value?.data ?? [])
const totalPages = computed<number>(() => results.value?.pagination.pageCount ?? 1)
const recentPosts = computed<PostListItem[]>(() => recentResult.value?.data ?? [])
const total = computed<number>(() => recentResult.value?.pagination.total ?? 0)
const popularTags = computed<TagCount[]>(() => pickPopularTags(tags.value ?? [], POPULAR_TAGS, filters.value.tag))
const resultCount = computed<number | undefined>(() =>
  filters.value.search ? (results.value?.pagination.total ?? 0) : undefined,
)
const filtered = computed<boolean>(() => hasActiveFilters(filters.value))
const federated = computed<boolean>(() => fediverseOn.value && locale.value === config.public.fediverseLocale)
// The fediverse ranking needs the fediverse module
const sortOptions = computed<BlogSort[]>(() => BLOG_SORTS.filter(option => option !== 'fediverse' || fediverseOn.value))
const eyebrow = computed<string>(() => t('blog.eyebrow', { count: padCount(total.value) }, total.value))

// A failed list says nothing about the category: the page shows what it has instead of a 404
function isUnknownCategory(): boolean {
  const slug = filters.value.category
  return Boolean(slug) && !categoriesFailed.value && !hasCategory(slug!)
}

function notFound(): Error {
  return createError({ statusCode: 404, statusMessage: 'Not Found', fatal: true })
}

// The requests above are already running: waiting for the list adds no round trip. A 404 here is a real status on the server and in a static build
await categoriesLoaded()
if (isUnknownCategory()) throw notFound()

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

// The page is reused between categories, so setup does not run again: check the new one
watch(() => filters.value.category, () => {
  if (isUnknownCategory()) showError(notFound())
})

watch(() => filters.value.search, (search) => {
  if (search !== searchTerm(searchInput.value)) searchInput.value = search ?? ''
})

// Page n of one language is not page n of the other: the switcher goes to the first page and pages above it have no hreflang
// A category that exists in one language only has no page in the other, so the switch goes to that blog's list instead and no hreflang points there
watch([() => route.path, hasPage], () => {
  setAlternates(Object.fromEntries(hasPage.value.map(code => [
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
          title: t('blog.feeds.title', { site: site.value.name, category: labelOf(filters.value.category) }),
          href: `${siteUrl.value}${feedPath(locale.value, filters.value.category)}`,
        }]
      : []),
  ],
}))

useSeoMeta({
  title: () => pageTitle('Blog', site.value.name),
  ogTitle: () => pageTitle('Blog', site.value.name),
  description:
    () => t('blog.metaDescription', { site: site.value.name }),
  ogDescription:
    () => t('blog.metaDescription', { site: site.value.name }),
  ogUrl: () => canonicalUrl.value,
  ogImage: () => defaultOgImage.value,
  ogImageAlt: () => `${site.value.name} — Blog`,
  twitterCard: 'summary_large_image',
  twitterImage: () => defaultOgImage.value,
  twitterTitle: () => pageTitle('Blog', site.value.name),
  twitterDescription:
    () => t('blog.metaDescription', { site: site.value.name }),
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
