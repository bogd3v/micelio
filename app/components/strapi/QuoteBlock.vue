<script setup lang="ts">
import type { StrapiQuote } from '~/interfaces'

defineProps<{
  block: StrapiQuote
}>()
</script>

<template>
  <blockquote class="border-l-4 border-[var(--link)] pl-6 my-8 italic">
    <p class="text-xl text-[var(--ink)] mb-2" v-html="block.html ?? ''" />
    <cite v-if="block.title" class="text-sm text-[var(--ink-muted)] not-italic">
      — {{ block.title }}
    </cite>
  </blockquote>
</template>
