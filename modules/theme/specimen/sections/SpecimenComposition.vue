<script setup lang="ts">
import SectionRenderer from '~/components/section/SectionRenderer.vue'
import { COMPOSITION_SECTIONS } from '../fixtures'

// The bands of a group and a reference, through the real SectionRenderer (ADR 0022)
const { t } = useI18n()
</script>

<template>
  <div class="myc-specimen-stack">
    <div>
      <h3 class="myc-specimen-label">{{ t('specimen.composition.groups') }}</h3>
      <p class="myc-body-s">{{ t('specimen.composition.reference') }}</p>
      <div class="myc-specimen-frame">
        <SectionRenderer :sections="COMPOSITION_SECTIONS" />
      </div>
    </div>
  </div>
</template>
