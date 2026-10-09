<script setup lang="ts">
import { SPECIMEN_SECTIONS } from './sections'

defineOptions({ name: 'ThemeSpecimenPage' })

const { t } = useI18n()

useSeoMeta({
  title: () => t('specimen.title'),
  description: () => t('specimen.lead'),
  robots: 'noindex, nofollow',
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
