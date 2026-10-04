<script setup lang="ts">
import type { LogoVariant } from '~/interfaces'
import { LOGO_PATHS, LOGO_TRANSFORM } from '~/helpers/logo'

const props = withDefaults(defineProps<{
  size?: number
  variant?: LogoVariant
  wordmark?: boolean
}>(), {
  size: 40,
  variant: 'auto',
  wordmark: false,
})

const site = useSite()

const width = computed<number>(() => Math.round(props.size * 1.31))
const wordStyle = computed<Record<string, string> | undefined>(() =>
  props.wordmark ? { fontSize: `${Math.round(props.size * 0.55)}px` } : undefined,
)
</script>

<template>
  <span :class="['bd-logo', `bd-logo-${variant}`]" :style="wordStyle">
    <svg
      class="bd-logo-mark"
      viewBox="10 70 506 386"
      :width="width"
      :height="size"
      :role="wordmark ? undefined : 'img'"
      :aria-label="wordmark ? undefined : site.name"
      :aria-hidden="wordmark ? 'true' : undefined"
      focusable="false"
    >
      <g :transform="LOGO_TRANSFORM">
        <path
          v-for="(path, index) in LOGO_PATHS"
          :key="index"
          :d="path.d"
          :class="`bd-logo-${path.part}`"
        />
      </g>
    </svg>
    <span v-if="wordmark" class="bd-logo-word">Bog<span class="bd-logo-dev">Dev</span></span>
  </span>
</template>
