<script setup lang="ts">
import type { IconStyle } from '~/interfaces/icons'

const { t } = useI18n()

// Names of the core's catalogue (ADR 0021). `abacus` has no filled alternate in Tabler: its filled drawing falls back to outline
const NAMES = ['leaf', 'heart', 'map-pin', 'mail', 'star', 'home', 'search', 'abacus']
const STYLES: IconStyle[] = ['outline', 'filled']
</script>

<template>
  <div class="myc-specimen-stack">
    <p class="myc-body-s">{{ t('specimen.icons.lead') }}</p>
    <div v-for="style in STYLES" :key="style">
      <h3 class="myc-specimen-label">{{ t(`specimen.icons.${style}`) }}</h3>
      <div class="myc-specimen-row" :data-specimen="`icons-${style}`">
        <MycIcon v-for="name in NAMES" :key="name" :name="name" :icon-style="style" />
      </div>
    </div>
    <div>
      <h3 class="myc-specimen-label">{{ t('specimen.icons.alone') }}</h3>
      <div class="myc-specimen-row" data-specimen="icons-alone">
        <MycIcon name="star" :label="t('specimen.icons.alone')" />
      </div>
    </div>
  </div>
</template>
