<script setup lang="ts">
import type { ButtonVariant } from '~/interfaces'

const { t } = useI18n()

const VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'accent', 'text']
</script>

<template>
  <div class="myc-specimen-stack">
    <div v-for="size in (['md', 'sm'] as const)" :key="size">
      <h3 class="myc-specimen-label">{{ t('specimen.controls.buttons', { size }) }}</h3>
      <div class="myc-specimen-row">
        <MycButton v-for="variant in VARIANTS" :key="variant" :variant="variant" :size="size">{{ t(`specimen.controls.variants.${variant}`) }}</MycButton>
        <MycButton variant="accent" :size="size" arrow>{{ t('specimen.controls.arrow') }}</MycButton>
        <MycButton href="#controls" variant="secondary" :size="size">{{ t('specimen.controls.link') }}</MycButton>
      </div>
    </div>

    <div>
      <h3 class="myc-specimen-label">{{ t('specimen.controls.disabled') }}</h3>
      <div class="myc-specimen-row">
        <MycButton v-for="variant in VARIANTS" :key="variant" :variant="variant" disabled>{{ t(`specimen.controls.variants.${variant}`) }}</MycButton>
      </div>
      <p class="myc-body-s">{{ t('specimen.controls.interactive') }}</p>
    </div>

    <div>
      <h3 class="myc-specimen-label">{{ t('specimen.controls.switches') }}</h3>
      <div class="myc-specimen-row">
        <MycThemeSwitch />
        <MycLangSwitch />
        <MycAccountMenu />
        <span class="myc-specimen-logo"><MycMastodonLogo label="Mastodon" /></span>
      </div>
    </div>

    <p class="myc-body-s">{{ t('specimen.controls.chrome') }}</p>
  </div>
</template>
