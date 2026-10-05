<script setup lang="ts">
import type { ThemeMode } from '~/interfaces'

const emit = defineEmits<{
  change: [theme: ThemeMode]
}>()

const { t } = useI18n()
const { theme, setTheme } = useTheme()

const options: ThemeMode[] = ['noche', 'dia']

function select(next: ThemeMode, event: MouseEvent): void {
  if (next === theme.value) return
  setTheme(next, event.currentTarget)
  emit('change', next)
}
</script>

<template>
  <div class="bd-seg-group" role="group" :aria-label="t('bd.header.theme')">
    <button
      v-for="option in options"
      :key="option"
      type="button"
      :class="['bd-seg', `bd-seg-${option}`]"
      :aria-pressed="theme === option ? 'true' : 'false'"
      @click="select(option, $event)"
    >
      {{ t(`bd.header.${option}`) }}
    </button>
  </div>
</template>
