<script setup lang="ts">
import { optionAttributes } from '~/helpers/blockOptions'
import type { NewsletterSection } from '~/interfaces'

defineProps<{ section: NewsletterSection }>()

const enabled = useModule('newsletter')
const titleId = useId()
const formId = useId()
</script>

<template>
  <section v-if="enabled" class="myc-section" data-section="newsletter" v-bind="optionAttributes(section)" :data-variant="section.variant" :aria-labelledby="section.title ? (section.anchor || titleId) : undefined">
    <div class="myc-section-inner">
      <SectionHead :title="section.title" :eyebrow="section.eyebrow" :anchor="section.anchor" :title-id="titleId" />
      <MycNewsletterForm :id="`nl-${formId}`" hide-heading :description="section.text ?? undefined" :button-label="section.buttonLabel ?? undefined" />
    </div>
  </section>
</template>
