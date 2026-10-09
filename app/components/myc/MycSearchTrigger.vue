<script setup lang="ts">
// The only place that decides what a search control does in static builds: a link that <micelio-search> (MycSearchIsland)
// turns into the button that opens the Pagefind palette. Without JS it goes to the blog list, or, in a build with no blog, to the site navigation.
withDefaults(defineProps<{
  /** Announces the Cmd/Ctrl + K shortcut (dynamic only). */
  shortcut?: boolean
}>(), {
  shortcut: false,
})

const emit = defineEmits<{
  search: []
}>()

const { isStatic, blogEnabled, menuId } = useStaticSite()
const { localizePath } = useLocaleUtils()
const baseURL = useRuntimeConfig().app.baseURL
const fallbackPath = computed<string>(() => blogEnabled ? localizePath('/blog') : `${localizePath('/')}#${menuId}`)
</script>

<template>
  <!-- A plain link, not NuxtLink: the island turns it into a button, which must not inherit aria-current or router-link classes -->
  <a v-if="isStatic" :href="`${baseURL.replace(/\/+$/, '')}${fallbackPath}`" data-micelio-search-open>
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
