<script setup lang="ts">
import type { HeaderSection } from '~/interfaces'

withDefaults(defineProps<{
  active?: HeaderSection
  menuOpen?: boolean
}>(), {
  active: undefined,
  menuOpen: false,
})

const emit = defineEmits<{
  search: []
  menu: []
}>()

const { t } = useI18n()
const { localizePath } = useLocaleUtils()
const searchOn = useModule('search')
const { blogEnabled } = useStaticSite()
</script>

<template>
  <nav class="bd-tabbar" :aria-label="t('bd.mobile.tabs')">
    <NuxtLink :to="localizePath('/')" class="bd-tab" :aria-current="active === 'home' ? 'page' : undefined">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true" focusable="false"><path d="M4 11 L12 4 L20 11 M6 9.5 V20 H18 V9.5" /></svg>
      <span>{{ t('nav.home') }}</span>
    </NuxtLink>
    <NuxtLink v-if="blogEnabled" :to="localizePath('/blog')" class="bd-tab" :aria-current="active === 'blog' ? 'page' : undefined">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true" focusable="false"><path d="M5 4 H19 V20 H5 Z M8 8 H16 M8 12 H16 M8 16 H13" /></svg>
      <span>{{ t('nav.blog') }}</span>
    </NuxtLink>
    <BdSearchTrigger v-if="searchOn" class="bd-tab" @search="emit('search')">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="6" /><path d="M15.5 15.5 L20 20" /></svg>
      <span>{{ t('bd.header.search') }}</span>
    </BdSearchTrigger>
    <BdMenuTrigger class="bd-tab" :open="menuOpen" @menu="emit('menu')">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true" focusable="false"><path d="M4 7 H20 M4 12 H20 M4 17 H20" /></svg>
      <span>{{ t('bd.mobile.menu') }}</span>
    </BdMenuTrigger>
  </nav>
</template>
