<script setup lang="ts">
import type { StrapiQuote } from '~/interfaces'

defineProps<{
  block: StrapiQuote
}>()
</script>

<template>
  <blockquote class="bd-quote">
    <!-- eslint-disable-next-line vue/no-v-html -- sanitized on the server (app/helpers/markdown.ts) -->
    <p class="bd-quote-text" v-html="block.html ?? ''" />
    <cite v-if="block.title" class="bd-quote-cite">
      — {{ block.title }}
    </cite>
  </blockquote>
</template>
