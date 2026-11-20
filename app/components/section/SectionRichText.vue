<script setup lang="ts">
import { optionAttributes } from '~/helpers/blockOptions'
import type { ProseSection, RichTextSection, StrapiRichText } from '~/interfaces'
import RichTextBlock from '~/components/strapi/RichTextBlock.vue'

// The one page renderer of Markdown text, for `section.rich-text` and for `shared.rich-text` (`prose`): the text is drawn by the article's
// `RichTextBlock`, so a page and an article render the same HTML the same way (Mermaid island and copy buttons included)
const props = defineProps<{ section: RichTextSection | ProseSection }>()

const block = computed<StrapiRichText>(() => ({ id: 0, __component: 'shared.rich-text', body: null, html: props.section.html }))
</script>

<template>
  <section class="myc-section" data-section="rich-text" v-bind="optionAttributes(section)">
    <div class="myc-section-inner">
      <RichTextBlock class="myc-section-text myc-prose" :block="block" />
    </div>
  </section>
</template>
