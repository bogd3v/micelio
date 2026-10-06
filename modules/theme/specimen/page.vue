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
  <div class="bd-specimen">
    <header class="bd-specimen-head">
      <span class="bd-eyebrow">{{ t('specimen.eyebrow') }}</span>
      <h1 class="bd-heading-1">{{ t('specimen.title') }}</h1>
      <p class="bd-body-l">{{ t('specimen.lead') }}</p>
      <nav class="bd-specimen-index" :aria-label="t('specimen.indexLabel')">
        <a v-for="section in SPECIMEN_SECTIONS" :key="section.id" class="bd-chip" :href="`#${section.id}`">{{ t(section.title) }}</a>
      </nav>
    </header>

    <section
      v-for="section in SPECIMEN_SECTIONS"
      :id="section.id"
      :key="section.id"
      class="bd-specimen-group"
      :data-section="section.id"
      :aria-labelledby="`${section.id}-title`"
    >
      <h2 :id="`${section.id}-title`" class="bd-heading-2 bd-specimen-title">{{ t(section.title) }}</h2>
      <component :is="section.component" />
    </section>
  </div>
</template>
