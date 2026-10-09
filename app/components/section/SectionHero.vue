<script setup lang="ts">
import type { HeroSection } from '~/interfaces'

defineProps<{
  section: HeroSection
  /** 1 when the hero opens the page and its title is the page's h1 */
  headingLevel?: 1 | 2
}>()

const titleId = useId()
</script>

<template>
  <section class="myc-section" data-section="hero" :data-variant="section.variant" :aria-labelledby="titleId">
    <!-- A background cannot hold controls: a video has no place here (it has no poster either), so the text sits on the surface -->
    <SectionMedia v-if="section.variant === 'full-bleed' && !section.media?.mime?.startsWith('video/')" :media="section.media" sizes="100vw" eager />
    <div class="myc-section-inner">
      <SectionHead :title="section.title" :text="section.text" :title-id="titleId" :level="headingLevel" />
      <div v-if="section.primaryLink || section.secondaryLink" class="myc-section-actions">
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
