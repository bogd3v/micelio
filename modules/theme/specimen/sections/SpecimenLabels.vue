<script setup lang="ts">
import { AUTHOR, CATEGORIES_SAMPLE, CREDIT } from '../fixtures'

const { t, tm } = useI18n()

// One picture per slug the active theme ships art for (`theme.illustration.<slug>`), so the slot is covered for any theme; none for a theme with no art
const illustrated = Object.keys(tm('theme.illustration') as Record<string, unknown>)
</script>

<template>
  <div class="myc-specimen-stack">
    <div>
      <h3 class="myc-specimen-label">{{ t('specimen.labels.categories') }}</h3>
      <div class="myc-specimen-row">
        <MycCategoryTag v-for="category in CATEGORIES_SAMPLE" :key="category.slug" :category="category.slug" />
      </div>
      <div class="myc-specimen-row">
        <MycCategoryTag v-for="category in CATEGORIES_SAMPLE" :key="category.slug" :category="category.slug" href="#labels" />
      </div>
    </div>

    <div v-if="illustrated.length">
      <h3 class="myc-specimen-label">{{ t('specimen.labels.illustrations') }}</h3>
      <div class="myc-specimen-row" data-specimen="illustrations">
        <ThemeIllustration v-for="(slug, index) in illustrated" :key="slug" :category="slug" :color="`var(--category-${(index % 5) + 1})`" :size="120" />
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
