<script setup lang="ts">
import { CATEGORIES } from '~/helpers/categories'
import { AUTHOR, CREDIT } from '../fixtures'

const { t } = useI18n()
</script>

<template>
  <div class="bd-specimen-stack">
    <div>
      <h3 class="bd-specimen-label">{{ t('specimen.labels.categories') }}</h3>
      <div class="bd-specimen-row">
        <BdCategoryTag v-for="category in CATEGORIES" :key="category" :category="category" />
      </div>
      <div class="bd-specimen-row">
        <BdCategoryTag v-for="category in CATEGORIES" :key="category" :category="category" href="#labels" />
      </div>
    </div>

    <div>
      <h3 class="bd-specimen-label">{{ t('specimen.labels.chips') }}</h3>
      <div class="bd-specimen-row">
        <button type="button" class="bd-chip">{{ t('specimen.labels.chip') }}</button>
        <button type="button" class="bd-chip" aria-pressed="true">{{ t('specimen.labels.pressed') }}</button>
        <button type="button" class="bd-chip" disabled>{{ t('specimen.labels.disabled') }}</button>
        <kbd class="bd-kbd">Ctrl K</kbd>
        <span class="bd-badge bd-badge-reader">{{ t('specimen.labels.reader') }}</span>
        <span class="bd-badge bd-badge-editor">{{ t('specimen.labels.editor') }}</span>
        <span class="bd-badge bd-badge-draft">{{ t('specimen.labels.draft') }}</span>
        <BlogAuthorBadge :author="AUTHOR" />
        <BlogAuthorBadge :author="AUTHOR" size="lg" />
      </div>
    </div>

    <div>
      <h3 class="bd-specimen-label">{{ t('specimen.labels.text') }}</h3>
      <p class="bd-body">
        <BdHighlight :text="t('specimen.labels.highlightText')" :query="t('specimen.labels.highlightQuery')" />
      </p>
      <p class="bd-meta"><BdFigureCredit :credit="CREDIT" /></p>
    </div>
  </div>
</template>
