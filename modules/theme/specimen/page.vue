<script setup lang="ts">
import { SPECIMEN_SECTIONS } from './sections'
import { CATEGORIES_SAMPLE } from './fixtures'
import { CATEGORIES_SOURCE_KEY } from '~/constants/categories'

defineOptions({ name: 'ThemeSpecimenPage' })

const { t } = useI18n()

// The specimen shows its own categories, so it needs no CMS
provide(CATEGORIES_SOURCE_KEY, CATEGORIES_SAMPLE)

useSeoMeta({
  title: () => t('specimen.title'),
  description: () => t('specimen.lead'),
  robots: 'noindex, nofollow',
})

// A frame shows a whole region next to the page's own: its `h1` reads as a level-4 heading under the group's label (WCAG 1.3.1), and
// the buttons that open the search or the menu are inert, since a copy has nothing to open (WCAG 2.1.1). Client side, like the id
// renames of SpecimenRegions; the server HTML keeps both (docs/theme-testing.md)
onMounted(() => {
  for (const heading of document.querySelectorAll('.myc-specimen-frame h1')) heading.setAttribute('aria-level', '4')
  for (const button of document.querySelectorAll('.myc-specimen-frame button[aria-haspopup="dialog"]')) button.setAttribute('inert', '')
})
</script>

<template>
  <div class="myc-specimen">
    <header class="myc-specimen-head">
      <span class="myc-eyebrow">{{ t('specimen.eyebrow') }}</span>
      <h1 class="myc-heading-1">{{ t('specimen.title') }}</h1>
      <p class="myc-body-l">{{ t('specimen.lead') }}</p>
      <nav class="myc-specimen-index" :aria-label="t('specimen.indexLabel')">
        <a v-for="section in SPECIMEN_SECTIONS" :key="section.id" class="myc-chip" :href="`#${section.id}`">{{ t(section.title) }}</a>
      </nav>
    </header>

    <section
      v-for="section in SPECIMEN_SECTIONS"
      :id="section.id"
      :key="section.id"
      class="myc-specimen-group"
      :data-section="section.id"
      :aria-labelledby="`${section.id}-title`"
    >
      <h2 :id="`${section.id}-title`" class="myc-heading-2 myc-specimen-title">{{ t(section.title) }}</h2>
      <component :is="section.component" v-bind="section.props" />
    </section>
  </div>
</template>
