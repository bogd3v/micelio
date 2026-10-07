<script setup lang="ts">
import type { ButtonVariant, PageLink } from '~/interfaces'
import { resolveSectionLink } from '~/helpers/links'

const props = defineProps<{
  link?: PageLink | null
  /** A button variant renders a BdButton; without it, a plain link */
  variant?: ButtonVariant
  arrow?: boolean
}>()

const { getLocalePrefix, localizePath } = useLocaleUtils()

const target = computed(() => props.link ? resolveSectionLink(props.link.url, getLocalePrefix(), localizePath) : null)
// mailto: and in-page links need no rel; a site path or another site gets noopener
const rel = computed<string | undefined>(() => target.value?.external && !target.value.href.toLowerCase().startsWith('mailto:') ? 'noopener' : undefined)
</script>

<template>
  <template v-if="link && target">
    <BdButton v-if="variant" :href="target.href" :variant="variant" :arrow="arrow" :rel="rel">{{ link.label }}</BdButton>
    <NuxtLink v-else :to="target.href" :rel="rel">{{ link.label }}</NuxtLink>
  </template>
</template>
