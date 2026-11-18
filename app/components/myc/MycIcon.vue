<script setup lang="ts">
import type { IconStyle } from '~/interfaces/icons'

// A name of the core's catalogue drawn from the page's sprite (ADR 0021, section 3): no icon file is requested.
// Decorative unless it has a label, which is the accessible name of an icon that stands alone.
const props = withDefaults(defineProps<{
  name: string
  iconStyle?: IconStyle
  label?: string
}>(), {
  iconStyle: 'outline',
  label: undefined,
})

const href = computed<string>(() => useIconSprite(props.name, props.iconStyle))
</script>

<template>
  <svg
    class="myc-icon"
    width="1em"
    height="1em"
    stroke-width="1.5"
    focusable="false"
    :aria-hidden="label ? undefined : 'true'"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
  >
    <use :href="href" />
  </svg>
</template>
