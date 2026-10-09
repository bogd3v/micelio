<script setup lang="ts">
import type { CtaSection } from '~/interfaces'

defineProps<{ section: CtaSection }>()

const titleId = useId()
</script>

<template>
  <section class="myc-section" data-section="cta" :data-variant="section.variant" :aria-labelledby="titleId">
    <div class="myc-section-inner">
      <SectionHead :title="section.title" :text="section.text" :title-id="titleId" />
      <div v-if="section.primaryLink || section.secondaryLink" class="myc-section-actions">
        <SectionLink :link="section.primaryLink" variant="primary" arrow />
        <SectionLink :link="section.secondaryLink" variant="secondary" />
      </div>
    </div>
  </section>
</template>
