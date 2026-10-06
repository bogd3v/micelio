<script setup lang="ts">
import type { StrapiRichText } from '~/interfaces'

defineProps<{
  block: StrapiRichText
}>()

const root = ref<HTMLElement | null>(null)

useCodeBlockCopy(root)
useMermaid(root)
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- sanitized on the server (app/helpers/markdown.ts) -->
  <div ref="root" v-html="block.html ?? ''" />
</template>
