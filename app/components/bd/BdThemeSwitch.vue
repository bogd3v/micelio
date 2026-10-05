<script setup lang="ts">
import type { ThemeMode, ThemeModeDefinition } from '~/interfaces'

const emit = defineEmits<{
  change: [theme: ThemeMode]
}>()

const { t, te } = useI18n()
const { modes, theme, setTheme } = useTheme()

function label(mode: ThemeModeDefinition): string {
  const key = `theme.modes.${mode.id}`
  return te(key) ? t(key) : (mode.name ?? mode.id)
}

function select(next: ThemeMode, event: MouseEvent): void {
  if (next === theme.value) return
  setTheme(next, event.currentTarget)
  emit('change', next)
}
</script>

<template>
  <div v-if="modes.length > 1" class="bd-seg-group" role="group" :aria-label="t('bd.header.theme')">
    <button
      v-for="mode in modes"
      :key="mode.id"
      type="button"
      class="bd-seg"
      :data-mode="mode.id"
      :aria-pressed="theme === mode.id ? 'true' : 'false'"
      @click="select(mode.id, $event)"
    >
      {{ label(mode) }}
    </button>
  </div>
</template>
