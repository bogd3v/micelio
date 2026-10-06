<script setup lang="ts">
import { COLOR_ROLES } from '../../roles.mjs'

const { t } = useI18n()

const TYPE_STEPS: Array<{ cls: string, key: string }> = [
  { cls: 'bd-display-xl', key: 'displayXl' },
  { cls: 'bd-display-l', key: 'displayL' },
  { cls: 'bd-heading-1', key: 'heading1' },
  { cls: 'bd-heading-2', key: 'heading2' },
  { cls: 'bd-heading-3', key: 'heading3' },
  { cls: 'bd-body-l', key: 'bodyL' },
  { cls: 'bd-body', key: 'body' },
  { cls: 'bd-body-s', key: 'bodyS' },
  { cls: 'bd-eyebrow', key: 'eyebrow' },
  { cls: 'bd-meta', key: 'meta' },
]
</script>

<template>
  <div class="bd-specimen-stack">
    <div>
      <h3 class="bd-specimen-label">{{ t('specimen.foundations.type') }}</h3>
      <div class="bd-specimen-stack">
        <p v-for="step in TYPE_STEPS" :key="step.key" :class="step.cls">
          {{ t(`specimen.foundations.steps.${step.key}`) }}
        </p>
        <p class="font-display bd-heading-2">{{ t('specimen.foundations.display') }}</p>
        <p class="font-mono">{{ t('specimen.foundations.mono') }}</p>
      </div>
    </div>

    <div>
      <h3 class="bd-specimen-label">{{ t('specimen.foundations.colors') }}</h3>
      <ul class="bd-specimen-swatches">
        <li v-for="role in COLOR_ROLES" :key="role" class="bd-specimen-swatch">
          <span class="bd-specimen-chip" :style="{ background: `var(--${role})` }" aria-hidden="true" />
          <code>{{ role }}</code>
        </li>
      </ul>
    </div>
  </div>
</template>
