<script setup lang="ts">
import { Category } from '~/interfaces'
import { categoryColor } from '~/helpers/categories'

const props = withDefaults(defineProps<{
  category: Category
  size?: number
}>(), {
  size: 200,
})

const color = computed<string>(() => categoryColor(props.category))
const height = computed<number>(() => Math.round(props.size * 0.75))
</script>

<template>
  <svg
    class="bogota-bird"
    :width="size"
    :height="height"
    viewBox="0 0 160 120"
    fill="none"
    stroke="currentColor"
    stroke-width="1.25"
    stroke-linejoin="round"
    stroke-linecap="round"
    aria-hidden="true"
    focusable="false"
    :style="{ color }"
  >
    <template v-if="category === Category.Privacy">
      <path d="M8 100 L152 90 M118 92 L136 78" />
      <path d="M40 70 L58 50 L86 44 L104 48 L112 60 L106 76 L86 88 L60 88 Z" />
      <path d="M86 44 L86 88 M104 48 L86 88" />
      <path d="M104 48 L110 34 L124 30 L136 36 L138 48 L126 56 L112 60 Z" />
      <path d="M112 41 L138 39 L138 48 L114 50 Z" fill="currentColor" />
      <circle cx="126" cy="44" r="2" fill="var(--surface-raised)" stroke="none" />
      <path d="M138 41 L150 43 Q153 47 148 50 L138 48" />
      <path d="M60 58 L92 54 L100 70 L70 80 Z M92 54 L70 80" />
      <path d="M44 74 L12 88 L16 97 L60 88" />
      <path d="M80 88 L80 95 M92 86 L94 93" />
    </template>
    <template v-else-if="category === Category.Diy">
      <path d="M50 62 L78 54 L104 56 L118 62 L104 68 L78 70 Z M78 54 L78 70 M104 56 L104 68" />
      <path d="M104 56 L114 51 L126 55 L129 62 L118 66 Z" />
      <path d="M129 59 L138 61 L129 63" />
      <circle cx="119" cy="57" r="1.6" fill="currentColor" stroke="none" />
      <path d="M82 56 L96 30 L146 6 L106 40 L98 57 Z M96 30 L98 57 M146 6 L96 44" />
      <path d="M86 69 L68 92 L34 116 L80 80 Z M68 92 L80 80" />
      <path d="M52 60 L12 46 L34 62 L14 80 L52 66" />
    </template>
    <template v-else-if="category === Category.Ai">
      <path d="M6 44 L50 47" />
      <path d="M50 47 L54 36 L66 30 L78 34 L80 46 L70 54 L56 54 Z" />
      <path d="M56 54 L66 44 L80 46 M66 44 L70 54 M54 36 L66 44" />
      <circle cx="66" cy="39" r="2.2" fill="currentColor" stroke="none" />
      <path d="M70 54 L80 46 L100 52 L118 70 L122 84 L108 86 L90 76 Z" />
      <path d="M100 52 L90 76 M118 70 L90 76 M80 46 L90 76" />
      <path d="M108 86 L122 84 L138 110 L126 114 L116 100 Z M122 84 L126 114" />
      <path d="M84 50 L96 6 L114 2 L106 24 L100 52 Z M96 6 L100 52 M114 2 L92 38" />
      <path d="M94 58 L136 30 L148 36 L112 66 M136 30 L104 62" />
    </template>
    <template v-else-if="category === Category.Software">
      <path d="M22 64 L40 48 L70 40 L96 42 L108 32 L122 28 L134 34 L136 44 L124 54 L114 58 L106 80 L86 92 L60 94 L42 86 Z" />
      <path d="M108 32 L114 58 M122 28 L124 54 M96 42 L114 58" />
      <path d="M50 54 L84 50 L102 62 L92 80 L62 84 Z M84 50 L62 84 M102 62 L62 84" />
      <path d="M42 86 L22 64 L4 94 L12 100 Z M22 64 L12 100" />
      <path d="M134 34 L152 38 L136 44 Z" fill="currentColor" />
      <circle cx="124" cy="36" r="3.4" />
      <circle cx="124" cy="36" r="1.2" fill="currentColor" stroke="none" />
      <path d="M84 92 L80 114 M96 88 L98 114 M72 114 L88 114 M90 114 L106 114" />
    </template>
    <template v-else-if="category === Category.Linux">
      <path d="M40 120 L60 2 M54 40 L32 18 L50 34" />
      <path d="M56 66 L68 52 L90 46 L104 54 L110 66 L100 78 L78 86 L62 82 Z" />
      <path d="M90 46 L96 30 L110 25 L122 31 L125 43 L111 54 L104 54 Z" fill="currentColor" fill-opacity=".9" />
      <path d="M125 36 L140 40 L125 44" />
      <circle cx="112" cy="36" r="2" fill="var(--surface-raised)" stroke="none" />
      <path d="M68 58 L92 54 L100 70 L78 80 Z M92 54 L78 80" />
      <path d="M62 82 L56 66 L36 100 L46 104 Z M56 66 L46 104" />
      <path d="M80 86 L58 72 M92 82 L58 80" />
    </template>
  </svg>
</template>
