<script setup lang="ts">
import type { StrapiOpenSource } from '~/interfaces'

const SEARCH_HREF = '#search'

defineProps<{
  block: StrapiOpenSource
}>()

function onGuideClick(event: MouseEvent): void {
  const link = (event.target as Element).closest('a')
  if (link?.getAttribute('href') !== SEARCH_HREF) return
  event.preventDefault()
  window.dispatchEvent(new CustomEvent('skip-to-search'))
}
</script>

<template>
  <section class="bd-home-section bd-open-source bd-reveal" :aria-label="block.eyebrow || undefined">
    <div class="bd-open-source-main">
      <p v-if="block.eyebrow" class="bd-eyebrow bd-home-eyebrow">{{ block.eyebrow }}</p>
      <p v-if="block.text" class="bd-open-source-text">{{ block.text }}</p>
      <BdCodeBlock v-if="block.code" :code="block.code" lang="shell" />
    </div>
    <div v-if="block.guide?.length" class="bd-open-source-guide">
      <h2 v-if="block.guideTitle" class="bd-eyebrow bd-home-eyebrow">{{ block.guideTitle }}</h2>
      <ul class="bd-guide-list" @click="onGuideClick">
        <li v-for="item in block.guide" :key="item.id">
          <span class="bd-guide-arrow" aria-hidden="true">→</span>
          <!-- eslint-disable-next-line vue/no-v-html -- sanitized on the server (app/helpers/markdown.ts) -->
          <span v-html="item.html ?? ''" />
        </li>
      </ul>
    </div>
  </section>
</template>
