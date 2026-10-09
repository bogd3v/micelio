<script setup lang="ts">
import { blogPath } from '~/helpers/blog'
import type { CategoryCount, Locale, PaletteGroup, PaletteOption, SearchPostResult } from '~/interfaces'
import { isCategory, categoryColor } from '~/helpers/categories'
import { CATEGORIES } from '~/constants/categories'
import { formatDotDate } from '~/helpers/formatDate'
import { cycleIndex, matchesQuery, padCount } from '~/helpers/search'
import { MIN_SEARCH_LENGTH } from '~/constants/search'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { t, locale } = useI18n()
const { searchPosts } = useStrapi()
const { localizePath } = useLocaleUtils()
const site = useSite()
const fediverseUser = useFediverseUser()
const fediverseOn = useModule('fediverse')
const { modes, nextTheme, toggle, modeLabel } = useTheme()

const dialogRef = ref<HTMLElement>()
const inputRef = ref<HTMLInputElement>()
const query = ref('')
const inContent = ref(false)
const articles = ref<SearchPostResult[]>([])
const counts = ref<Record<string, number>>({})
const loading = ref(false)
const activeIndex = ref(-1)
const isOpen = computed<boolean>(() => props.open)
let debounceTimer: ReturnType<typeof setTimeout> | undefined
let requestId = 0

const trimmed = computed<string>(() => query.value.trim())
const searching = computed<boolean>(() => trimmed.value.length >= MIN_SEARCH_LENGTH)
const groups = computed<PaletteGroup[]>(() => {
  const articleOptions: PaletteOption[] = searching.value
    ? articles.value.map(post => ({
        id: `article-${post.documentId}`,
        kind: 'article',
        label: post.title,
        snippet: post.matchedIn === 'title' ? undefined : post.snippet || undefined,
        hint: formatDotDate(post.publishedAt) || undefined,
        color: isCategory(post.category?.slug) ? categoryColor(post.category.slug) : 'var(--link)',
        to: `${localizePath('/blog')}/${post.slug}`,
      }))
    : []
  const topicOptions: PaletteOption[] = CATEGORIES
    .map(slug => ({
      id: `topic-${slug}`,
      kind: 'topic' as const,
      label: t(`myc.categories.${slug}`),
      hint: slug in counts.value ? padCount(counts.value[slug]!) : undefined,
      color: categoryColor(slug),
      to: blogPath({ category: slug, page: 1 }, localizePath('/blog')),
    }))
    .filter(option => matchesQuery(option.label, trimmed.value))
  const actionOptions: PaletteOption[] = [
    ...(modes.length > 1 ? [{ id: 'action-theme', kind: 'action' as const, label: t('myc.search.toMode', { mode: modeLabel(nextTheme.value) }), action: 'theme' as const }] : []),
    ...(fediverseOn.value ? [{ id: 'action-fediverse', kind: 'action' as const, label: t('myc.search.fediverse'), hint: fediverseUser, action: 'fediverse' as const }] : []),
  ]
  return [
    { kind: 'article' as const, options: articleOptions },
    { kind: 'topic' as const, options: topicOptions },
    { kind: 'action' as const, options: actionOptions },
  ].filter(group => group.options.length > 0)
})
const options = computed<PaletteOption[]>(() => groups.value.flatMap(group => group.options))
const matchCount = computed<number>(() => options.value.filter(option => option.kind !== 'action').length)
const empty = computed<boolean>(() => searching.value && !loading.value && matchCount.value === 0)
const activeId = computed<string | undefined>(() => options.value[activeIndex.value]?.id)
const announcement = computed<string>(() => {
  if (loading.value) return t('myc.search.loading')
  if (empty.value) return t('myc.search.empty', { query: trimmed.value })
  if (trimmed.value === '') return ''
  return t('myc.search.results', { count: matchCount.value }, matchCount.value)
})

function close(): void {
  emit('close')
}

function onCancel(event: Event): void {
  event.preventDefault()
  close()
}

function onDialogClick(event: MouseEvent): void {
  if (event.target === dialogRef.value) close()
}

function indexOf(option: PaletteOption): number {
  return options.value.findIndex(item => item.id === option.id)
}

async function run(option: PaletteOption): Promise<void> {
  if (option.action === 'theme') {
    toggle()
    close()
    return
  }
  close()
  const target = option.action === 'fediverse' ? `${localizePath('/')}#fediverso` : option.to
  if (target) await navigateTo(target)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = cycleIndex(activeIndex.value, options.value.length, event.key === 'ArrowDown' ? 1 : -1)
  } else if (event.key === 'Enter') {
    const option = options.value[activeIndex.value]
    if (!option) return
    event.preventDefault()
    run(option)
  }
}

async function search(term: string): Promise<void> {
  const current = ++requestId
  try {
    const results = await searchPosts(term, locale.value as Locale, inContent.value)
    if (current === requestId) articles.value = results
  } catch {
    if (current === requestId) articles.value = []
  } finally {
    if (current === requestId) loading.value = false
  }
}

async function loadCounts(): Promise<void> {
  try {
    const categories = await $fetch<CategoryCount[]>('/api/categories', { query: { locale: locale.value } })
    counts.value = Object.fromEntries(
      categories.filter(category => category.slug).map(category => [category.slug as string, category.count]),
    )
  } catch {
    counts.value = {}
  }
}

function cancelSearch(): void {
  clearTimeout(debounceTimer)
  requestId++
}

// Cleared when it opens, not when it closes: the panel keeps its content while it fades out
function reset(): void {
  cancelSearch()
  query.value = ''
  articles.value = []
  loading.value = false
  activeIndex.value = -1
}

function scheduleSearch(term: string): void {
  clearTimeout(debounceTimer)
  activeIndex.value = -1
  if (term.length < MIN_SEARCH_LENGTH) {
    requestId++
    articles.value = []
    loading.value = false
    return
  }
  loading.value = true
  debounceTimer = setTimeout(() => search(term), 300)
}

watch(trimmed, scheduleSearch)

watch(inContent, () => scheduleSearch(trimmed.value))

watch(options, (list) => {
  if (activeIndex.value >= list.length) activeIndex.value = list.length - 1
})

watch(isOpen, (open) => {
  const dialog = dialogRef.value as HTMLDialogElement | undefined
  if (!dialog) return
  if (open && !dialog.open) {
    reset()
    dialog.showModal()
    inputRef.value?.focus()
    loadCounts()
  }
  if (!open) {
    if (dialog.open) dialog.close()
    cancelSearch()
  }
})

onBeforeUnmount(() => clearTimeout(debounceTimer))
</script>

<template>
  <dialog
    ref="dialogRef"
    class="myc-palette"
    :aria-label="t('myc.search.dialog', { site: site.name })"
    @cancel="onCancel"
    @close="open && close()"
    @click="onDialogClick"
  >
    <div class="myc-palette-panel">
      <div class="myc-palette-bar">
        <label for="myc-palette-input" class="myc-sr">{{ t('myc.search.placeholder') }}</label>
        <span class="myc-palette-prompt" aria-hidden="true">→</span>
        <input
          id="myc-palette-input"
          ref="inputRef"
          v-model="query"
          class="myc-palette-input"
          type="search"
          role="combobox"
          autocomplete="off"
          spellcheck="false"
          aria-autocomplete="list"
          aria-controls="myc-palette-list"
          :aria-expanded="options.length > 0 ? 'true' : 'false'"
          :aria-activedescendant="activeId"
          :placeholder="t('myc.search.placeholder')"
          @keydown="onKeydown"
        >
        <button type="button" class="myc-chip myc-palette-esc" :aria-label="t('myc.search.close')" @click="close">Esc</button>
      </div>

      <label class="myc-meta myc-palette-content">
        <input v-model="inContent" type="checkbox">
        {{ t('myc.search.content') }}
      </label>

      <p v-if="!searching" class="myc-meta myc-palette-note">{{ t('myc.search.minLength', { count: MIN_SEARCH_LENGTH }) }}</p>
      <p v-else-if="loading" class="myc-meta myc-palette-note">{{ t('myc.search.loading') }}</p>
      <p v-else-if="empty" class="myc-meta myc-palette-note">{{ t('myc.search.empty', { query: trimmed }) }}</p>

      <div id="myc-palette-list" class="myc-palette-list" role="listbox" :aria-label="t('myc.search.dialog', { site: site.name })">
        <div
          v-for="group in groups"
          :key="group.kind"
          role="group"
          :aria-labelledby="`myc-palette-group-${group.kind}`"
          class="myc-palette-group"
        >
          <div :id="`myc-palette-group-${group.kind}`" class="myc-eyebrow myc-palette-heading" role="presentation">
            {{ t(`myc.search.groups.${group.kind}`) }}
          </div>
          <div
            v-for="option in group.options"
            :id="option.id"
            :key="option.id"
            role="option"
            :aria-selected="option.id === activeId ? 'true' : 'false'"
            :class="['myc-result', { 'myc-result-active': option.id === activeId }]"
            @click="run(option)"
            @mousemove="activeIndex = indexOf(option)"
          >
            <span class="myc-eyebrow myc-result-kind" aria-hidden="true">{{ t(`myc.search.kinds.${option.kind}`) }}</span>
            <span v-if="option.color" class="myc-result-dot" :style="{ background: option.color }" aria-hidden="true" />
            <span class="myc-result-text">
              <span class="myc-result-label"><MycHighlight :text="option.label" :query="option.kind === 'article' ? trimmed : undefined" /></span>
              <span v-if="option.snippet" class="myc-result-snippet"><MycHighlight :text="option.snippet" :query="trimmed" /></span>
            </span>
            <span v-if="option.hint" class="myc-meta myc-result-hint">{{ option.hint }}</span>
            <span v-else class="myc-meta myc-result-hint" aria-hidden="true">→</span>
          </div>
        </div>
      </div>

      <p class="myc-sr" role="status" aria-live="polite">{{ announcement }}</p>

      <div class="myc-meta myc-palette-foot" aria-hidden="true">
        <span>{{ t('myc.search.help') }}</span>
        <span v-if="searching && !loading">{{ t('myc.search.results', { count: matchCount }, matchCount) }}</span>
      </div>
    </div>
  </dialog>
</template>
