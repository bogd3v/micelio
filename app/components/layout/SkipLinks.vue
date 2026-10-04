<script setup lang="ts">
const { t } = useI18n()
const searchOn = useModule('search')

function skipToContent() {
  const main = document.querySelector('main')
  if (main) {
    main.tabIndex = -1
    main.focus()
  }
}

function skipToSearch() {
  window.dispatchEvent(new CustomEvent('skip-to-search'))
}
</script>

<template>
  <div
    class="fixed top-0 left-0 right-0 z-[9999] skip-links-container"
    role="navigation"
    :aria-label="t('common.ariaSkipLinks')"
  >
    <div
      class="bg-[var(--link)] text-[var(--on-ink)] px-4 py-2 flex flex-wrap gap-4"
    >
      <a
        href="#main-content"
        class="text-sm font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-white rounded px-2 py-1"
        @click.prevent="skipToContent"
      >
        {{ t('common.skipToMain') }}
      </a>
      <a
        v-if="searchOn"
        href="#search"
        class="text-sm font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-white rounded px-2 py-1"
        @click.prevent="skipToSearch"
      >
        {{ t('common.skipToSearch') }}
      </a>
    </div>
  </div>
</template>

<style scoped>
.skip-links-container > div {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.skip-links-container:focus-within > div {
  position: static;
  width: auto;
  height: auto;
  padding: 0;
  margin: 0;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
</style>
