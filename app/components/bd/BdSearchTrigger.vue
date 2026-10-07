<script setup lang="ts">
// The only place that decides what a search control does in static builds.
// Pagefind (#243, PR 6) replaces the static branch with its palette.
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
</script>

<template>
  <NuxtLink v-if="isStatic" :to="localizePath('/blog')">
    <slot />
  </NuxtLink>
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
