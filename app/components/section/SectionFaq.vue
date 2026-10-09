<script setup lang="ts">
import type { FaqSection } from '~/interfaces'

defineProps<{ section: FaqSection }>()

const titleId = useId()
</script>

<template>
  <section class="myc-section" data-section="faq" :data-variant="section.variant" :aria-labelledby="section.title ? titleId : undefined">
    <div class="myc-section-inner">
      <SectionHead :title="section.title" :title-id="titleId" />
      <div class="myc-section-items">
        <details v-for="(item, index) in section.items" :key="index" class="myc-section-item">
          <summary class="myc-section-question">{{ item.question }}</summary>
          <!-- eslint-disable-next-line vue/no-v-html -- sanitized on the server (app/helpers/markdown.ts) -->
          <div class="myc-section-answer" v-html="item.html" />
        </details>
      </div>
    </div>
  </section>
</template>
