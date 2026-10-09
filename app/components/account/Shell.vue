<script setup lang="ts">
const { t } = useI18n()
const { localizePath } = useLocaleUtils()
const site = useSite()

const points = computed<{ id: string, title: string, text: string, icon: string }[]>(() => [
  {
    id: 'minimal',
    title: t('account.aside.minimalTitle'),
    text: t('account.aside.minimalText'),
    icon: 'M8 8 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 M4 21 C4 16 8 14 12 14 C16 14 20 16 20 21',
  },
  {
    id: 'trackers',
    title: t('account.aside.trackersTitle'),
    text: t('account.aside.trackersText'),
    icon: 'M5 11 H19 V21 H5 Z M8 11 V8 C8 5.8 9.8 4 12 4 C14.2 4 16 5.8 16 8 V11',
  },
  {
    id: 'leave',
    title: t('account.aside.leaveTitle'),
    text: t('account.aside.leaveText'),
    icon: 'M4 7 H20 M9 7 V4 H15 V7 M6 7 L7 20 H17 L18 7 M10 11 V16 M14 11 V16',
  },
  {
    id: 'editor',
    title: t('account.aside.editorTitle', { site: site.value.name }),
    text: t('account.aside.editorText'),
    icon: 'M6 3 H14 L19 8 V21 H6 Z M14 3 V8 H19 M9 13 H16 M9 17 H13',
  },
])
</script>

<template>
  <div class="myc-account-page">
    <div class="myc-account-card">
      <span class="myc-corner myc-corner-tl" aria-hidden="true" />
      <span class="myc-corner myc-corner-br" aria-hidden="true" />
      <slot />
    </div>
    <aside class="myc-account-aside" aria-labelledby="myc-account-why">
      <div class="myc-account-aside-head">
        <p class="myc-eyebrow">{{ t('account.aside.eyebrow') }}</p>
        <h2 id="myc-account-why" class="myc-account-aside-title myc-stretch">{{ t('account.aside.title') }}</h2>
      </div>
      <ul class="myc-account-points">
        <li v-for="point in points" :key="point.id" class="myc-account-point">
          <span class="myc-account-point-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true" focusable="false"><path :d="point.icon" /></svg>
          </span>
          <span class="myc-account-point-body">
            <span class="myc-account-point-title">{{ point.title }}</span>
            <span class="myc-account-point-text">{{ point.text }}</span>
          </span>
        </li>
      </ul>
      <NuxtLink :to="localizePath('/privacy')" class="myc-account-privacy">{{ t('account.aside.privacy') }} <span aria-hidden="true">→</span></NuxtLink>
    </aside>
  </div>
</template>
