<script setup lang="ts">
import type { StrapiMedia } from '~/interfaces'
import { formatFigureNumber, mediaCaption } from '~/helpers/figures'

const props = defineProps<{
  block: StrapiMedia
  figureNumber?: number
}>()

const { getMediaUrl } = useStrapi()
const { t } = useI18n()

const src = computed<string>(() => getMediaUrl(props.block.file.url))
const caption = computed<string>(() => mediaCaption(props.block))
</script>

<template>
  <figure class="myc-fig">
    <div class="myc-fig-media">
      <NuxtImg
        :src="src"
        :alt="block.file.alternativeText || 'Media'"
        :width="block.file.width || 1000"
        :height="block.file.height"
        format="webp"
        loading="lazy"
      />
    </div>
    <figcaption v-if="caption || block.credit">
      <span v-if="caption || figureNumber" class="myc-fig-cap">
        <span v-if="figureNumber" class="myc-fig-n">{{ t('bd.figure.number', { n: formatFigureNumber(figureNumber) }) }}</span>
        {{ caption }}
      </span>
      <BdFigureCredit v-if="block.credit" :credit="block.credit" />
    </figcaption>
  </figure>
</template>
