<script setup lang="ts">
import type { CategoryCount, Locale, PaletteGroup, PaletteOption, SearchPostResult } from '~/interfaces'
import { CATEGORIES, CATEGORY_INFO, isCategory } from '~/helpers/categories'
import { formatDotDate } from '~/helpers/formatDate'
import { MIN_SEARCH_LENGTH, cycleIndex, matchesQuery, padCount } from '~/helpers/search'

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
const { theme, toggle } = useTheme()

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

useFocusTrap(dialogRef, isOpen)

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
        color: isCategory(post.category?.slug) ? `var(--${CATEGORY_INFO[post.category.slug].token})` : 'var(--chillon)',
        to: `${localizePath('/blog')}/${post.slug}`,
      }))
    : []
  const topicOptions: PaletteOption[] = CATEGORIES
    .map(slug => ({
      id: `topic-${slug}`,
      kind: 'topic' as const,
      label: t(`bd.categories.${slug}`),
      hint: slug in counts.value ? padCount(counts.value[slug]!) : undefined,
      color: `var(--${CATEGORY_INFO[slug].token})`,
      to: `${localizePath('/blog')}?category=${slug}`,
    }))
    .filter(option => matchesQuery(option.label, trimmed.value))
  const actionOptions: PaletteOption[] = [
    { id: 'action-theme', kind: 'action', label: t(theme.value === 'noche' ? 'bd.search.toDia' : 'bd.search.toNoche'), action: 'theme' },
    ...(fediverseOn.value ? [{ id: 'action-fediverse', kind: 'action' as const, label: t('bd.search.fediverse'), hint: fediverseUser, action: 'fediverse' as const }] : []),
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
  if (loading.value) return t('bd.search.loading')
  if (empty.value) return t('bd.search.empty', { query: trimmed.value })
  if (trimmed.value === '') return ''
  return t('bd.search.results', { count: matchCount.value }, matchCount.value)
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

function reset(): void {
  clearTimeout(debounceTimer)
  requestId++
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
    dialog.showModal()
    inputRef.value?.focus()
    loadCounts()
  }
  if (!open) {
    if (dialog.open) dialog.close()
    reset()
  }
})

onBeforeUnmount(() => clearTimeout(debounceTimer))
</script>

<template>
  <dialog
    ref="dialogRef"
    class="bd-palette"
    :aria-label="t('bd.search.dialog', { site: site.name })"
    @cancel="onCancel"
    @close="open && close()"
    @click="onDialogClick"
  >
    <div class="bd-palette-panel">
      <div class="bd-palette-bar">
        <label for="bd-palette-input" class="bd-sr">{{ t('bd.search.placeholder') }}</label>
        <span class="bd-palette-prompt" aria-hidden="true">→</span>
        <input
          id="bd-palette-input"
          ref="inputRef"
          v-model="query"
          class="bd-palette-input"
          type="search"
          role="combobox"
          autocomplete="off"
          spellcheck="false"
          aria-autocomplete="list"
          aria-controls="bd-palette-list"
          :aria-expanded="options.length > 0 ? 'true' : 'false'"
          :aria-activedescendant="activeId"
          :placeholder="t('bd.search.placeholder')"
          @keydown="onKeydown"
        >
        <button type="button" class="bd-chip bd-palette-esc" :aria-label="t('bd.search.close')" @click="close">Esc</button>
      </div>

      <label class="bd-meta bd-palette-content">
        <input v-model="inContent" type="checkbox">
        {{ t('bd.search.content') }}
      </label>

      <p v-if="!searching" class="bd-meta bd-palette-note">{{ t('bd.search.minLength', { count: MIN_SEARCH_LENGTH }) }}</p>
      <p v-else-if="loading" class="bd-meta bd-palette-note">{{ t('bd.search.loading') }}</p>
      <p v-else-if="empty" class="bd-meta bd-palette-note">{{ t('bd.search.empty', { query: trimmed }) }}</p>

      <div id="bd-palette-list" class="bd-palette-list" role="listbox" :aria-label="t('bd.search.dialog', { site: site.name })">
        <div
          v-for="group in groups"
          :key="group.kind"
          role="group"
          :aria-labelledby="`bd-palette-group-${group.kind}`"
          class="bd-palette-group"
        >
          <div :id="`bd-palette-group-${group.kind}`" class="bd-eyebrow bd-palette-heading" role="presentation">
            {{ t(`bd.search.groups.${group.kind}`) }}
          </div>
          <div
            v-for="option in group.options"
            :id="option.id"
            :key="option.id"
            role="option"
            :aria-selected="option.id === activeId ? 'true' : 'false'"
            :class="['bd-result', { 'bd-result-active': option.id === activeId }]"
            @click="run(option)"
            @mousemove="activeIndex = indexOf(option)"
          >
            <span class="bd-eyebrow bd-result-kind" aria-hidden="true">{{ t(`bd.search.kinds.${option.kind}`) }}</span>
            <span v-if="option.color" class="bd-result-dot" :style="{ background: option.color }" aria-hidden="true" />
            <span class="bd-result-text">
              <span class="bd-result-label"><BdHighlight :text="option.label" :query="option.kind === 'article' ? trimmed : undefined" /></span>
              <span v-if="option.snippet" class="bd-result-snippet"><BdHighlight :text="option.snippet" :query="trimmed" /></span>
            </span>
            <span v-if="option.hint" class="bd-meta bd-result-hint">{{ option.hint }}</span>
            <span v-else class="bd-meta bd-result-hint" aria-hidden="true">→</span>
          </div>
        </div>
      </div>

      <p class="bd-sr" role="status" aria-live="polite">{{ announcement }}</p>

      <div class="bd-meta bd-palette-foot" aria-hidden="true">
        <span>{{ t('bd.search.help') }}</span>
        <span v-if="searching && !loading">{{ t('bd.search.results', { count: matchCount }, matchCount) }}</span>
      </div>
    </div>
  </dialog>
</template>
