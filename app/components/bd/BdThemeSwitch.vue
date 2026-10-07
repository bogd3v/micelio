<script setup lang="ts">
import type { ThemeMode } from '~/interfaces'

const emit = defineEmits<{
  change: [theme: ThemeMode]
}>()

const { t } = useI18n()
const { modes, theme, setTheme, modeLabel } = useTheme()
// Static pages follow the stored or system mode through the inline init script
const { isStatic } = useStaticSite()

function select(next: ThemeMode, event: MouseEvent): void {
  if (next === theme.value) return
  setTheme(next, event.currentTarget)
  emit('change', next)
}
</script>

<template>
  <div v-if="modes.length > 1 && !isStatic" class="bd-seg-group" role="group" :aria-label="t('bd.header.theme')">
    <button
      v-for="mode in modes"
      :key="mode.id"
      type="button"
      class="bd-seg"
      :data-mode="mode.id"
      :aria-pressed="theme === mode.id ? 'true' : 'false'"
      @click="select(mode.id, $event)"
    >
      {{ modeLabel(mode.id) }}
    </button>
  </div>
</template>
