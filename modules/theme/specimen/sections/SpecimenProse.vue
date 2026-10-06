<script setup lang="ts">
import type { CalloutTone } from '~/interfaces'
import { PROSE_BLOCKS, SHELL_SAMPLE, TS_SAMPLE } from '../fixtures'

const { t } = useI18n()

const TONES: CalloutTone[] = ['note', 'warning', 'danger']
</script>

<template>
  <div class="bd-specimen-stack">
    <div>
      <h3 class="bd-specimen-label">{{ t('specimen.prose.article') }}</h3>
      <p class="bd-body-s">{{ t('specimen.prose.note') }}</p>
      <div class="bd-prose">
        <StrapiBlocksRenderer :blocks="PROSE_BLOCKS" />
      </div>
    </div>

    <div>
      <h3 class="bd-specimen-label">{{ t('specimen.prose.callouts') }}</h3>
      <div class="bd-specimen-stack">
        <BdCallout v-for="tone in TONES" :key="tone" :tone="tone">{{ t('specimen.prose.calloutBody') }}</BdCallout>
        <BdCallout tone="note" :title="t('specimen.prose.customTitle')">{{ t('specimen.prose.calloutBody') }}</BdCallout>
      </div>
    </div>

    <div>
      <h3 class="bd-specimen-label">{{ t('specimen.prose.code') }}</h3>
      <div class="bd-specimen-stack">
        <BdCodeBlock :code="SHELL_SAMPLE" lang="bash" />
        <BdCodeBlock :code="TS_SAMPLE" lang="ts" filename="slugify.ts" />
        <BdCodeBlock :code="TS_SAMPLE" :show-copy="false" />
      </div>
    </div>
  </div>
</template>
