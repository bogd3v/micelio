<script setup lang="ts">
import type { HeroSection } from '~/interfaces'

defineProps<{ section: HeroSection }>()

const titleId = useId()
</script>

<template>
  <section class="bd-section" data-section="hero" :data-variant="section.variant" :aria-labelledby="titleId">
    <SectionMedia v-if="section.variant === 'full-bleed'" :media="section.media" sizes="100vw" eager />
    <div class="bd-section-inner">
      <SectionHead :title="section.title" :text="section.text" :title-id="titleId" />
      <div v-if="section.primaryLink || section.secondaryLink" class="bd-section-actions">
        <SectionLink :link="section.primaryLink" variant="primary" arrow />
        <SectionLink :link="section.secondaryLink" variant="secondary" />
      </div>
      <SectionMedia
        v-if="section.variant !== 'full-bleed'"
        :media="section.media"
        :sizes="section.variant === 'split' ? '100vw lg:50vw' : '100vw xl:1100px'"
        eager
      />
    </div>
  </section>
</template>
