<script setup lang="ts">
import type { RichTextSection } from '~/interfaces'

defineProps<{ section: RichTextSection }>()
</script>

<template>
  <section class="bd-section" data-section="rich-text">
    <div class="bd-section-inner">
      <!-- eslint-disable-next-line vue/no-v-html -- sanitized on the server (app/helpers/markdown.ts) -->
      <div class="bd-section-text bd-prose" v-html="section.html" />
    </div>
  </section>
</template>
