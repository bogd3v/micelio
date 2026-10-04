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
