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
  <section class="myc-hero">
    <ThemeHero class="myc-hero-art" />
    <div class="myc-hero-copy">
      <p class="myc-eyebrow myc-hero-eyebrow">{{ eyebrow }}</p>
      <p v-if="hud.city" class="myc-meta myc-hero-place">
        <span class="myc-hero-diamond" aria-hidden="true">◆</span>
        <span>{{ [hud.city, hud.altitude].filter(Boolean).join(' · ') }}</span>
      </p>
      <h1 class="myc-hero-title myc-wide">{{ t('home.hero.title') }}</h1>
      <p class="myc-hero-lead">{{ themeMessage('hero.subtitle', 'home.hero.subtitle') }}</p>
      <div class="myc-hero-actions">
        <MycButton href="#latest" arrow>{{ t('home.hero.read') }}</MycButton>
        <MycButton :href="localizePath('/about')" variant="text" class="myc-hero-about">{{ t('nav.about') }}</MycButton>
      </div>
    </div>
    <ThemeHero class="myc-hero-art-compact" compact />
  </section>
</template>
