<script setup lang="ts">
import type { CtaSection } from '~/interfaces'

defineProps<{ section: CtaSection }>()

const titleId = useId()
</script>

<template>
  <section class="bd-section" data-section="cta" :data-variant="section.variant" :aria-labelledby="titleId">
    <div class="bd-section-inner">
      <SectionHead :title="section.title" :text="section.text" :title-id="titleId" />
      <div v-if="section.primaryLink || section.secondaryLink" class="bd-section-actions">
        <SectionLink :link="section.primaryLink" variant="primary" arrow />
        <SectionLink :link="section.secondaryLink" variant="secondary" />
      </div>
    </div>
  </section>
</template>
