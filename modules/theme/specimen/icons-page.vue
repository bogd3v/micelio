<script setup lang="ts">
import SpecimenIcons from './sections/SpecimenIcons.vue'

defineOptions({ name: 'ThemeSpecimenIconsPage' })

const { t } = useI18n()

useSeoMeta({
  title: () => t('specimen.sections.icons'),
  robots: 'noindex, nofollow',
})
</script>

<template>
  <div class="myc-specimen">
    <section class="myc-specimen-group" data-section="icons" aria-labelledby="icons-title">
      <h1 id="icons-title" class="myc-heading-2 myc-specimen-title">{{ t('specimen.sections.icons') }}</h1>
      <SpecimenIcons />
    </section>
  </div>
</template>
