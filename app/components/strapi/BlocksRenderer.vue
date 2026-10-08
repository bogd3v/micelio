<script setup lang="ts">
import type { StrapiBlock } from '~/interfaces'
import type { Component } from 'vue'
import { figureBlockKey, figureNumbers } from '~/helpers/figures'
import StrapiRichTextBlock from '~/components/strapi/RichTextBlock.vue'
import StrapiQuoteBlock from '~/components/strapi/QuoteBlock.vue'
import StrapiMediaBlock from '~/components/strapi/MediaBlock.vue'
import StrapiPlaygroundBlock from '~/components/strapi/PlaygroundBlock.vue'
import StrapiSliderBlock from '~/components/strapi/SliderBlock.vue'
import StrapiProfileBlock from '~/components/strapi/ProfileBlock.vue'
import StrapiStatementBlock from '~/components/strapi/StatementBlock.vue'
import StrapiTopicsBlock from '~/components/strapi/TopicsBlock.vue'
import StrapiProjectsBlock from '~/components/strapi/ProjectsBlock.vue'
import StrapiPrinciplesBlock from '~/components/strapi/PrinciplesBlock.vue'
import StrapiOpenSourceBlock from '~/components/strapi/OpenSourceBlock.vue'
import StrapiContactBlock from '~/components/strapi/ContactBlock.vue'

const props = defineProps<{
  blocks: StrapiBlock[] | null | undefined
}>()

const componentMap: Readonly<Record<StrapiBlock['__component'], Component>> = {
  'shared.rich-text': StrapiRichTextBlock,
  'shared.quote': StrapiQuoteBlock,
  'shared.media': StrapiMediaBlock,
  'shared.playground': StrapiPlaygroundBlock,
  'shared.slider': StrapiSliderBlock,
  'about.profile': StrapiProfileBlock,
  'about.statement': StrapiStatementBlock,
  'about.topics': StrapiTopicsBlock,
  'about.projects': StrapiProjectsBlock,
  'about.principles': StrapiPrinciplesBlock,
  'about.open-source': StrapiOpenSourceBlock,
  'about.contact': StrapiContactBlock,
}

const knownBlocks = computed<StrapiBlock[]>(() =>
  (props.blocks ?? []).filter(block => block.__component in componentMap),
)

const numbers = computed<Record<string, number>>(() => figureNumbers(knownBlocks.value))

function extraProps(block: StrapiBlock): { figureNumber?: number } {
  const figureNumber = numbers.value[figureBlockKey(block)]
  return figureNumber ? { figureNumber } : {}
}
</script>

<template>
  <component
    :is="componentMap[block.__component]"
    v-for="block in knownBlocks"
    :key="`${block.__component}-${block.id}`"
    :block="block"
    v-bind="extraProps(block)"
  />
</template>
