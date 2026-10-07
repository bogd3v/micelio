<script setup lang="ts">
import type { MediaShowcaseSection } from '~/interfaces'

defineProps<{ section: MediaShowcaseSection }>()

const titleId = useId()
</script>

<template>
  <section class="bd-section" data-section="media-showcase" :data-variant="section.variant" :aria-labelledby="section.title ? titleId : undefined">
    <div class="bd-section-inner">
      <SectionMedia :media="section.media" :sizes="section.variant === 'stacked' ? '100vw xl:1100px' : '100vw lg:50vw'" />
      <div class="bd-section-head">
        <h2 v-if="section.title" :id="titleId" class="bd-section-title">{{ section.title }}</h2>
        <!-- eslint-disable-next-line vue/no-v-html -- sanitized on the server (app/helpers/markdown.ts) -->
        <div v-if="section.html" class="bd-section-text" v-html="section.html" />
        <div v-if="section.link" class="bd-section-actions">
          <SectionLink :link="section.link" variant="secondary" arrow />
        </div>
      </div>
    </div>
  </section>
</template>
