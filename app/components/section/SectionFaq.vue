<script setup lang="ts">
import type { FaqSection } from '~/interfaces'

defineProps<{ section: FaqSection }>()

const titleId = useId()
</script>

<template>
  <section class="bd-section" data-section="faq" :data-variant="section.variant" :aria-labelledby="section.title ? titleId : undefined">
    <div class="bd-section-inner">
      <SectionHead :title="section.title" :title-id="titleId" />
      <div class="bd-section-items">
        <details v-for="(item, index) in section.items" :key="index" class="bd-section-item">
          <summary class="bd-section-question">{{ item.question }}</summary>
          <!-- eslint-disable-next-line vue/no-v-html -- sanitized on the server (app/helpers/markdown.ts) -->
          <div class="bd-section-answer" v-html="item.html" />
        </details>
      </div>
    </div>
  </section>
</template>
