<script setup lang="ts">
import { optionAttributes } from '~/helpers/blockOptions'
import type { CtaSection } from '~/interfaces'

defineProps<{ section: CtaSection }>()

const titleId = useId()
</script>

<template>
  <section class="myc-section" data-section="cta" v-bind="optionAttributes(section)" :data-variant="section.variant" :aria-labelledby="section.anchor || titleId">
    <div class="myc-section-inner">
      <SectionHead :title="section.title" :eyebrow="section.eyebrow" :anchor="section.anchor" :text="section.text" :title-id="titleId" />
      <div v-if="section.primaryLink || section.secondaryLink" class="myc-section-actions">
        <SectionLink :link="section.primaryLink" variant="primary" arrow />
        <SectionLink :link="section.secondaryLink" variant="secondary" />
      </div>
    </div>
  </section>
</template>
