<script setup lang="ts">
import type { NewsletterSection } from '~/interfaces'

defineProps<{ section: NewsletterSection }>()

const enabled = useModule('newsletter')
const titleId = useId()
const formId = useId()
</script>

<template>
  <section v-if="enabled" class="bd-section" data-section="newsletter" :data-variant="section.variant" :aria-labelledby="section.title ? titleId : undefined">
    <div class="bd-section-inner">
      <SectionHead :title="section.title" :title-id="titleId" />
      <BdNewsletterForm :id="`nl-${formId}`" hide-heading :description="section.text ?? undefined" :button-label="section.buttonLabel ?? undefined" />
    </div>
  </section>
</template>
