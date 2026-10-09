<script setup lang="ts">
import type { RichTextSection } from '~/interfaces'

defineProps<{ section: RichTextSection }>()
</script>

<template>
  <section class="myc-section" data-section="rich-text">
    <div class="myc-section-inner">
      <!-- eslint-disable-next-line vue/no-v-html -- sanitized on the server (app/helpers/markdown.ts) -->
      <div class="myc-section-text myc-prose" v-html="section.html" />
    </div>
  </section>
</template>
