<script setup lang="ts">
import { COLOR_ROLES } from '../../roles.mjs'

const { t } = useI18n()

const TYPE_STEPS: Array<{ cls: string, key: string }> = [
  { cls: 'myc-display-xl', key: 'displayXl' },
  { cls: 'myc-display-l', key: 'displayL' },
  { cls: 'myc-heading-1', key: 'heading1' },
  { cls: 'myc-heading-2', key: 'heading2' },
  { cls: 'myc-heading-3', key: 'heading3' },
  { cls: 'myc-body-l', key: 'bodyL' },
  { cls: 'myc-body', key: 'body' },
  { cls: 'myc-body-s', key: 'bodyS' },
  { cls: 'myc-eyebrow', key: 'eyebrow' },
  { cls: 'myc-meta', key: 'meta' },
]
</script>

<template>
  <div class="myc-specimen-stack">
    <div>
      <h3 class="myc-specimen-label">{{ t('specimen.foundations.type') }}</h3>
      <div class="myc-specimen-stack">
        <p v-for="step in TYPE_STEPS" :key="step.key" :class="step.cls">
          {{ t(`specimen.foundations.steps.${step.key}`) }}
        </p>
        <p class="font-display myc-heading-2">{{ t('specimen.foundations.display') }}</p>
        <p class="font-mono">{{ t('specimen.foundations.mono') }}</p>
      </div>
    </div>

    <div>
      <h3 class="myc-specimen-label">{{ t('specimen.foundations.colors') }}</h3>
      <ul class="myc-specimen-swatches">
        <li v-for="role in COLOR_ROLES" :key="role" class="myc-specimen-swatch">
          <span class="myc-specimen-chip" :style="{ background: `var(--${role})` }" aria-hidden="true" />
          <code>{{ role }}</code>
        </li>
      </ul>
    </div>
  </div>
</template>
