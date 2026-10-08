<script setup lang="ts">
import { mermaid as mermaidOverrides } from '#micelio/theme'
import type { StrapiRichText } from '~/interfaces'
import { MERMAID_ELEMENT } from '~/helpers/mermaid'
import type { MermaidConfig } from '~/helpers/mermaid'

const props = defineProps<{
  block: StrapiRichText
}>()

const root = ref<HTMLElement | null>(null)
const { t } = useI18n()

useCodeBlockCopy(root)

// Diagrams are drawn by `app/islands/mermaid.ts` (ADR 0006, section 6); the page carries its label and the theme's overrides
if (props.block.html?.includes(`<${MERMAID_ELEMENT}`)) {
  const config: MermaidConfig = { label: t('bd.mermaid.label'), overrides: mermaidOverrides }
  useHeavyIsland('mermaid', MERMAID_ELEMENT, config)
}
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- sanitized on the server (app/helpers/markdown.ts) -->
  <div ref="root" v-html="block.html ?? ''" />
</template>
