<script setup lang="ts">
import { MIN_SEARCH_LENGTH } from '~/helpers/search'

// Server markup of the static search palette; `app/islands/search.ts` upgrades it (ADR 0006, sections 3 and 4).
// It holds every string the island shows, so the island has none of its own.
const { t } = useI18n()
const site = useSite()
const baseURL = useRuntimeConfig().app.baseURL

useIsland('search')

const dialogLabel = computed<string>(() => t('bd.search.dialog', { site: site.value.name }))
const pagefindSrc = `${baseURL.replace(/\/+$/, '')}/pagefind/pagefind.js`
// `{count}` and `{query}` stay in the text: the island fills them
const placeholders = { count: '{count}', query: '{query}' }
</script>

<template>
  <micelio-search
    data-pagefind-ignore
    :data-pagefind-src="pagefindSrc"
    :data-min-length="t('bd.search.minLength', { count: MIN_SEARCH_LENGTH })"
    :data-loading="t('bd.search.loading')"
    :data-empty="t('bd.search.empty', { query: placeholders.query })"
    :data-unavailable="t('bd.search.unavailable')"
    :data-results-none="t('bd.search.results', { count: placeholders.count }, 0)"
    :data-results-one="t('bd.search.results', { count: placeholders.count }, 1)"
    :data-results-other="t('bd.search.results', { count: placeholders.count }, 2)"
    :data-group-results="t('bd.search.groups.results')"
    :data-kind-article="t('bd.search.kinds.article')"
    :data-kind-page="t('bd.search.kinds.page')"
  >
    <dialog class="bd-palette" :aria-label="dialogLabel">
      <div class="bd-palette-panel">
        <div class="bd-palette-bar">
          <label for="bd-palette-input" class="bd-sr">{{ t('bd.search.placeholderStatic') }}</label>
          <span class="bd-palette-prompt" aria-hidden="true">→</span>
          <input
            id="bd-palette-input"
            class="bd-palette-input"
            type="search"
            role="combobox"
            autocomplete="off"
            spellcheck="false"
            aria-autocomplete="list"
            aria-controls="bd-palette-list"
            aria-expanded="false"
            :placeholder="t('bd.search.placeholderStatic')"
          >
          <button type="button" class="bd-chip bd-palette-esc" :aria-label="t('bd.search.close')">Esc</button>
        </div>

        <p class="bd-meta bd-palette-note" data-search-note>{{ t('bd.search.minLength', { count: MIN_SEARCH_LENGTH }) }}</p>

        <div id="bd-palette-list" class="bd-palette-list" role="listbox" :aria-label="dialogLabel" />

        <p class="bd-sr" role="status" aria-live="polite" />

        <div class="bd-meta bd-palette-foot" aria-hidden="true">
          <span>{{ t('bd.search.help') }}</span>
          <span data-search-count />
        </div>
      </div>
    </dialog>
  </micelio-search>
</template>
