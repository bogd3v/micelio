<script setup lang="ts">
const { t } = useI18n()
const site = useSite()

const username = computed<string>(() => site.value.supportHandle)
const url = computed<string>(() => `https://www.buymeacoffee.com/${username.value}`)
</script>

<template>
  <section class="bd-coffee" aria-labelledby="bd-coffee-title">
    <svg class="bd-coffee-cup" width="120" height="100" viewBox="0 0 120 100" aria-hidden="true" focusable="false">
      <g fill="none" stroke="var(--ink-muted)" stroke-width="1.4" stroke-linecap="round">
        <path class="bd-steam" d="M50 36 Q46 28 51 21 Q56 14 51 6" />
        <path class="bd-steam bd-steam-2" d="M60 34 Q56 26 61 19 Q66 12 61 4" />
        <path class="bd-steam bd-steam-3" d="M70 36 Q66 28 71 21 Q76 14 71 6" />
      </g>
      <path d="M12 88 Q60 98 108 88" fill="none" stroke="var(--ink-muted)" stroke-width="1.4" stroke-linecap="round" />
      <path d="M92 52 Q106 54 102 66 Q98 74 88 72" fill="none" stroke="var(--ink)" stroke-width="1.4" />
      <path d="M28 46 L34 80 Q60 88 86 80 L92 46 Z" fill="var(--surface-raised)" stroke="var(--ink)" stroke-width="1.4" stroke-linejoin="round" />
      <ellipse cx="60" cy="46" rx="32" ry="5" fill="var(--surface-raised)" stroke="var(--ink)" stroke-width="1.4" />
      <ellipse cx="60" cy="46.5" rx="27" ry="3.2" fill="var(--accent)" fill-opacity=".85" />
      <ThemeSupportArt />
    </svg>
    <div class="bd-coffee-body">
      <p class="bd-eyebrow bd-home-eyebrow">{{ t('buyMeACoffee.eyebrow') }}</p>
      <h2 id="bd-coffee-title" class="bd-coffee-title">{{ t('buyMeACoffee.supportMyWork') }}</h2>
      <p class="bd-coffee-text">{{ t('buyMeACoffee.description') }}</p>
      <p class="bd-meta bd-coffee-handle">buymeacoffee.com/{{ username }}</p>
    </div>
    <BdButton :href="url" class="bd-coffee-button" target="_blank" rel="noopener noreferrer">
      {{ t('buyMeACoffee.button') }} <span aria-hidden="true">↗</span>
    </BdButton>
  </section>
</template>
