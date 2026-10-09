<script setup lang="ts">
import { padCount } from '~/helpers/search'

const props = defineProps<{
  total: number
}>()

const { t } = useI18n()
const { localizePath } = useLocaleUtils()
const hud = useThemeHud()
const themeMessage = useThemeMessage()

const eyebrow = computed<string>(() => t('home.hero.eyebrow', { count: padCount(props.total) }, props.total))
</script>

<template>
  <section class="bd-hero">
    <ThemeHero class="bd-hero-art" />
    <div class="bd-hero-copy">
      <p class="bd-eyebrow bd-hero-eyebrow">{{ eyebrow }}</p>
      <p v-if="hud.city" class="bd-meta bd-hero-place">
        <span class="bd-hero-diamond" aria-hidden="true">◆</span>
        <span>{{ [hud.city, hud.altitude].filter(Boolean).join(' · ') }}</span>
      </p>
      <h1 class="bd-hero-title bd-wide">{{ t('home.hero.title') }}</h1>
      <p class="bd-hero-lead">{{ themeMessage('hero.subtitle', 'home.hero.subtitle') }}</p>
      <div class="bd-hero-actions">
        <BdButton href="#latest" arrow>{{ t('home.hero.read') }}</BdButton>
        <BdButton :href="localizePath('/about')" variant="text" class="bd-hero-about">{{ t('nav.about') }}</BdButton>
      </div>
    </div>
    <ThemeHero class="bd-hero-art-compact" compact />
  </section>
</template>
