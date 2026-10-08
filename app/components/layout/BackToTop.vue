<script setup lang="ts">
const { t } = useI18n()
// Static builds have no JS: a link shown by a scroll timeline (folds away in dynamic builds, docs/performance.md)
const isStaticBuild = __STATIC_BUILD__
const StaticLink = __STATIC_BUILD__ ? defineAsyncComponent(() => import('./BackToTopStatic.vue')) : undefined
const { y: scrollY } = useWindowScroll()
const isVisible = computed(() => scrollY.value > 200)

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <component :is="StaticLink" v-if="isStaticBuild" />
  <Transition v-else name="fade">
    <button
      v-if="isVisible"
      class="bd-back-to-top"
      :aria-label="t('common.backToTop')"
      @click="scrollToTop"
    >
      <IconsChevronUp />
    </button>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
