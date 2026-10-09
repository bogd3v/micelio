<script setup lang="ts">
import { MIN_SEARCH_LENGTH } from '~/constants/search'

// Server markup of the static search palette; `app/islands/search.ts` upgrades it (ADR 0006, sections 3 and 4).
// It holds every string the island shows, so the island has none of its own.
const { t } = useI18n()
const site = useSite()
const baseURL = useRuntimeConfig().app.baseURL

useIsland('search')

const dialogLabel = computed<string>(() => t('myc.search.dialog', { site: site.value.name }))
// `{count}` and `{query}` stay in the text: the island fills them
const placeholders = { count: '{count}', query: '{query}' }
</script>

<template>
  <micelio-search
    data-pagefind-ignore
    :data-base-url="baseURL"
    :data-min-length="t('myc.search.minLengthStatic', { count: MIN_SEARCH_LENGTH })"
    :data-loading="t('myc.search.loading')"
    :data-empty="t('myc.search.empty', { query: placeholders.query })"
    :data-unavailable="t('myc.search.unavailable')"
    :data-results-none="t('myc.search.results', { count: placeholders.count }, 0)"
    :data-results-one="t('myc.search.results', { count: placeholders.count }, 1)"
    :data-results-other="t('myc.search.results', { count: placeholders.count }, 2)"
    :data-group-results="t('myc.search.groups.results')"
    :data-kind-article="t('myc.search.kinds.article')"
    :data-kind-page="t('myc.search.kinds.page')"
  >
    <dialog class="myc-palette" :aria-label="dialogLabel">
      <div class="myc-palette-panel">
        <div class="myc-palette-bar">
          <label for="myc-palette-input" class="myc-sr">{{ t('myc.search.placeholderStatic') }}</label>
          <span class="myc-palette-prompt" aria-hidden="true">→</span>
          <input
            id="myc-palette-input"
            class="myc-palette-input"
            type="search"
            role="combobox"
            autocomplete="off"
            spellcheck="false"
            aria-autocomplete="list"
            aria-controls="myc-palette-list"
            aria-expanded="false"
            :placeholder="t('myc.search.placeholderStatic')"
          >
          <button type="button" class="myc-chip myc-palette-esc" :aria-label="t('myc.search.close')">Esc</button>
        </div>

        <p class="myc-meta myc-palette-note" data-search-note>{{ t('myc.search.minLengthStatic', { count: MIN_SEARCH_LENGTH }) }}</p>

        <div id="myc-palette-list" class="myc-palette-list" role="listbox" :aria-label="dialogLabel" />

        <p class="myc-sr" role="status" aria-live="polite" />

        <div class="myc-meta myc-palette-foot" aria-hidden="true">
          <span>{{ t('myc.search.help') }}</span>
          <span data-search-count />
        </div>
      </div>
    </dialog>
  </micelio-search>
</template>
