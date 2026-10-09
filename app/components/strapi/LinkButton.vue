<script setup lang="ts">
import type { StrapiLink } from '~/interfaces'
import { resolveLink } from '~/helpers/links'

const props = defineProps<{
  link: StrapiLink
}>()

const { localizePath } = useLocaleUtils()

const target = computed(() => resolveLink(props.link.url, localizePath))
</script>

<template>
  <MycButton
    :href="target.href"
    :variant="link.variant"
    :arrow="link.variant === 'primary' && !target.external"
    :target="target.external ? '_blank' : undefined"
    :rel="target.external ? 'noopener noreferrer' : undefined"
  >
    {{ link.label }}<span v-if="target.external" aria-hidden="true"> ↗</span>
  </MycButton>
</template>
