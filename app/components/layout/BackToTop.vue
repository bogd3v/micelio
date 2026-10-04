<script setup lang="ts">
const { t } = useI18n()
const { y: scrollY } = useWindowScroll()
const isVisible = computed(() => scrollY.value > 200)

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <Transition name="fade">
    <button
      v-if="isVisible"
      class="fixed bottom-[calc(var(--bd-tabbar-h)+1.5rem)] right-6 z-50 w-12 h-12 rounded-full bg-[var(--link)] text-[var(--on-ink)] shadow-lg hover:bg-[color-mix(in oklab, var(--link) 80%, var(--ink))] hover:scale-110 transition-all duration-200 flex items-center justify-center"
      :aria-label="t('common.backToTop')"
      @click="scrollToTop"
    >
      <UIcon name="i-heroicons-chevron-up" class="w-6 h-6" />
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
