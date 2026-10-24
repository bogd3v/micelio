<script setup lang="ts">
// A monogram and the site name. Static: no events, no lifecycle (ADR 0005, section 12)
const props = withDefaults(defineProps<{
  size?: number
  context?: 'header' | 'footer'
}>(), {
  size: 40,
  context: 'header',
})

const site = useSite()

const letterId = `starter-mark-letter-${useId()}`

const initial = computed<string>(() => Array.from(site.value.name.trim())[0]?.toUpperCase() ?? '')
</script>

<template>
  <span :class="['starter-mark', `starter-mark-${props.context}`]">
    <svg
      class="starter-mark-glyph"
      viewBox="0 0 32 32"
      :width="props.size"
      :height="props.size"
      aria-hidden="true"
      focusable="false"
    >
      <circle class="starter-mark-ring" cx="16" cy="16" r="14.5" />
      <!-- The letter sits in a symbol so it is drawn but not read as the link's visible text (WCAG 2.5.3) -->
      <defs>
        <text :id="letterId" class="starter-mark-letter" x="16" y="22" text-anchor="middle">{{ initial }}</text>
      </defs>
      <use :href="`#${letterId}`" />
    </svg>
    <span class="starter-mark-name">{{ site.name }}</span>
  </span>
</template>
