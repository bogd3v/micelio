<script setup lang="ts">
import { LOGO_PATHS, LOGO_TRANSFORM } from './logo'

const props = withDefaults(defineProps<{
  size?: number
  context?: 'header' | 'footer'
}>(), {
  size: 40,
  context: 'header',
})

const site = useSite()

const width = computed<number>(() => Math.round(props.size * 1.31))
</script>

<template>
  <span class="bogota-lockup">
    <span :class="['bogota-mark', `bogota-mark-${context}`]">
      <svg
        class="bogota-mark-svg"
        viewBox="10 70 506 386"
        :width="width"
        :height="size"
        role="img"
        :aria-label="site.name"
        focusable="false"
      >
        <g :transform="LOGO_TRANSFORM">
          <path
            v-for="(path, index) in LOGO_PATHS"
            :key="index"
            :d="path.d"
            :class="`bogota-mark-${path.part}`"
          />
        </g>
      </svg>
    </span>
    <span class="bogota-word" aria-hidden="true">Bog<span class="bogota-word-dev">Dev</span></span>
  </span>
</template>
