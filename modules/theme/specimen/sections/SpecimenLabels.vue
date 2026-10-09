<script setup lang="ts">
import { CATEGORIES } from '~/constants/categories'
import { AUTHOR, CREDIT } from '../fixtures'

const { t } = useI18n()
</script>

<template>
  <div class="myc-specimen-stack">
    <div>
      <h3 class="myc-specimen-label">{{ t('specimen.labels.categories') }}</h3>
      <div class="myc-specimen-row">
        <MycCategoryTag v-for="category in CATEGORIES" :key="category" :category="category" />
      </div>
      <div class="myc-specimen-row">
        <MycCategoryTag v-for="category in CATEGORIES" :key="category" :category="category" href="#labels" />
      </div>
    </div>

    <div>
      <h3 class="myc-specimen-label">{{ t('specimen.labels.chips') }}</h3>
      <div class="myc-specimen-row">
        <button type="button" class="myc-chip">{{ t('specimen.labels.chip') }}</button>
        <button type="button" class="myc-chip" aria-pressed="true">{{ t('specimen.labels.pressed') }}</button>
        <a href="#" class="myc-chip" aria-current="page">{{ t('specimen.labels.current') }}</a>
        <button type="button" class="myc-chip" disabled>{{ t('specimen.labels.disabled') }}</button>
        <kbd class="myc-kbd">Ctrl K</kbd>
        <span class="myc-badge myc-badge-reader">{{ t('specimen.labels.reader') }}</span>
        <span class="myc-badge myc-badge-editor">{{ t('specimen.labels.editor') }}</span>
        <span class="myc-badge myc-badge-draft">{{ t('specimen.labels.draft') }}</span>
        <BlogAuthorBadge :author="AUTHOR" />
        <BlogAuthorBadge :author="AUTHOR" size="lg" />
      </div>
    </div>

    <div>
      <h3 class="myc-specimen-label">{{ t('specimen.labels.text') }}</h3>
      <p class="myc-body">
        <MycHighlight :text="t('specimen.labels.highlightText')" :query="t('specimen.labels.highlightQuery')" />
      </p>
      <p class="myc-meta"><MycFigureCredit :credit="CREDIT" /></p>
    </div>
  </div>
</template>
