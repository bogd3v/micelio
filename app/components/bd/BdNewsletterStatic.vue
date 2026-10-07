<script setup lang="ts">
// The newsletter of static builds: a plain form post to the provider, no Vue state (ADR 0006, section 5)
defineProps<{
  id: string
  hideHeading: boolean
  eyebrow: string
  title: string
  description: string
  showDescription: boolean
  placeholder: string
  buttonLabel: string
}>()

const { t } = useI18n()
const localizePath = useLocalePath()
const { newsletterProvider: provider } = useRuntimeConfig().public
</script>

<template>
  <!-- No target: without JS a popup cannot open; the provider's confirmation page replaces this one -->
  <form class="bd-news" method="post" :action="provider.action">
    <span v-if="!hideHeading" class="bd-eyebrow bd-news-eyebrow">{{ eyebrow }}</span>
    <h3 v-if="!hideHeading">{{ title }}</h3>
    <p v-if="showDescription">{{ description }}</p>
    <label :for="id" class="bd-eyebrow bd-news-label">{{ t('bd.newsletter.label') }}</label>
    <div class="bd-news-row">
      <input :id="id" class="bd-input" type="email" :name="provider.field" autocomplete="email" required :placeholder="placeholder">
      <input v-for="field in provider.hidden" :key="field.name" type="hidden" :name="field.name" :value="field.value">
      <BdButton type="submit" variant="accent" arrow>{{ buttonLabel }}</BdButton>
    </div>
    <i18n-t keypath="bd.newsletter.external" tag="p" scope="global" class="bd-news-note">
      <template #provider><strong>{{ provider.host }}</strong></template>
      <template #link><NuxtLink :to="localizePath('/privacy')">{{ t('bd.newsletter.privacyLink') }}</NuxtLink></template>
    </i18n-t>
  </form>
</template>
