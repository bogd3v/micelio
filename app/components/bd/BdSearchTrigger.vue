<script setup lang="ts">
// The only place that decides what a search control does in static builds: a link to /blog that
// <micelio-search> (BdSearchIsland) turns into the button that opens the Pagefind palette.
withDefaults(defineProps<{
  /** Announces the Cmd/Ctrl + K shortcut (dynamic only). */
  shortcut?: boolean
}>(), {
  shortcut: false,
})

const emit = defineEmits<{
  search: []
}>()

const { isStatic } = useStaticSite()
const { localizePath } = useLocaleUtils()
const baseURL = useRuntimeConfig().app.baseURL
</script>

<template>
  <!-- A plain link, not NuxtLink: the island turns it into a button, which must not inherit aria-current or router-link classes -->
  <a v-if="isStatic" :href="`${baseURL.replace(/\/+$/, '')}${localizePath('/blog')}`" data-micelio-search-open>
    <slot />
  </a>
  <button
    v-else
    type="button"
    aria-haspopup="dialog"
    :aria-keyshortcuts="shortcut ? 'Control+K Meta+K' : undefined"
    @click="emit('search')"
  >
    <slot />
  </button>
</template>
