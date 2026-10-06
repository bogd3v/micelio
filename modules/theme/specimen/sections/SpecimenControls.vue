<script setup lang="ts">
import type { ButtonVariant } from '~/interfaces'

const { t } = useI18n()

const VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'accent', 'text']
</script>

<template>
  <div class="bd-specimen-stack">
    <div v-for="size in (['md', 'sm'] as const)" :key="size">
      <h3 class="bd-specimen-label">{{ t('specimen.controls.buttons', { size }) }}</h3>
      <div class="bd-specimen-row">
        <BdButton v-for="variant in VARIANTS" :key="variant" :variant="variant" :size="size">{{ t(`specimen.controls.variants.${variant}`) }}</BdButton>
        <BdButton variant="accent" :size="size" arrow>{{ t('specimen.controls.arrow') }}</BdButton>
        <BdButton href="#controls" variant="secondary" :size="size">{{ t('specimen.controls.link') }}</BdButton>
      </div>
    </div>

    <div>
      <h3 class="bd-specimen-label">{{ t('specimen.controls.disabled') }}</h3>
      <div class="bd-specimen-row">
        <BdButton v-for="variant in VARIANTS" :key="variant" :variant="variant" disabled>{{ t(`specimen.controls.variants.${variant}`) }}</BdButton>
      </div>
      <p class="bd-body-s">{{ t('specimen.controls.interactive') }}</p>
    </div>

    <div>
      <h3 class="bd-specimen-label">{{ t('specimen.controls.switches') }}</h3>
      <div class="bd-specimen-row">
        <BdThemeSwitch />
        <BdLangSwitch />
        <BdAccountMenu />
        <span class="bd-specimen-logo"><BdMastodonLogo label="Mastodon" /></span>
      </div>
    </div>

    <p class="bd-body-s">{{ t('specimen.controls.chrome') }}</p>
  </div>
</template>
