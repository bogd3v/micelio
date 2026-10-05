<script setup lang="ts">
import type { HeaderSection } from '~/interfaces'
import { headerSection, isReadingPath } from '~/helpers/header'

const route = useRoute()
const section = useHeaderSection()
const searchOn = useModule('search')

const isSearchOpen = ref(false)
const isMobileMenuOpen = ref(false)

const active = computed<HeaderSection | undefined>(() => headerSection(route.path))
const reading = computed<boolean>(() => isReadingPath(route.path))

useKeyboardShortcut('k', () => {
  if (searchOn.value) isSearchOpen.value = !isSearchOpen.value
})

onMounted(() => {
  window.addEventListener('skip-to-search', () => {
    isSearchOpen.value = true
  })
})
</script>

<template>
  <div class="bd-app">
    <LayoutSkipLinks />
    <LayoutBackToTop />

    <RegionHeader
      :active="active"
      :reading="reading"
      :section="section || undefined"
      :menu-open="isMobileMenuOpen"
      @search="isSearchOpen = true"
      @menu="isMobileMenuOpen = true"
    />

    <BdMenuSheet
      :open="isMobileMenuOpen"
      :active="active"
      @close="isMobileMenuOpen = false"
    />

    <BdSearchPalette v-if="searchOn" :open="isSearchOpen" @close="isSearchOpen = false" />

    <main id="main-content" class="bd-app-main" role="main">
      <slot />
    </main>

    <RegionFooter />

    <BdPrivacyNotice />

    <BdTabBar
      :active="active"
      :menu-open="isMobileMenuOpen"
      @search="isSearchOpen = true"
      @menu="isMobileMenuOpen = true"
    />
  </div>
</template>
