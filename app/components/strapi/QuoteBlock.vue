<script setup lang="ts">
import type { StrapiQuote } from '~/interfaces'

defineProps<{
  block: StrapiQuote
}>()
</script>

<template>
  <blockquote class="border-l-4 border-[var(--primary)] pl-6 my-8 italic">
    <p class="text-xl text-[var(--foreground)] mb-2" v-html="block.html ?? ''" />
    <cite v-if="block.title" class="text-sm text-[var(--muted)] not-italic">
      — {{ block.title }}
    </cite>
  </blockquote>
</template>
