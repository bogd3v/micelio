<script setup lang="ts">
import type { StrapiQuote } from '~/interfaces'

defineProps<{
  block: StrapiQuote
}>()
</script>

<template>
  <blockquote class="myc-quote">
    <!-- eslint-disable-next-line vue/no-v-html -- sanitized on the server (app/helpers/markdown.ts) -->
    <p class="myc-quote-text" v-html="block.html ?? ''" />
    <cite v-if="block.title" class="myc-quote-cite">
      — {{ block.title }}
    </cite>
  </blockquote>
</template>
