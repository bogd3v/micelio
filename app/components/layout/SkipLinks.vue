<script setup lang="ts">
const { t } = useI18n()
const searchOn = useModule('search')
const { isStatic } = useStaticSite()

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
    class="myc-skip-links"
    role="navigation"
    :aria-label="t('common.ariaSkipLinks')"
  >
    <div class="myc-skip-links-bar">
      <a
        href="#main-content"
        class="myc-skip-link"
        @click.prevent="skipToContent"
      >
        {{ t('common.skipToMain') }}
      </a>
      <a
        v-if="searchOn && !isStatic"
        href="#search"
        class="myc-skip-link"
        @click.prevent="skipToSearch"
      >
        {{ t('common.skipToSearch') }}
      </a>
    </div>
  </div>
</template>
