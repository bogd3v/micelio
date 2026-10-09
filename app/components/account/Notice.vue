<script setup lang="ts">
const props = withDefaults(defineProps<{
  tone?: 'info' | 'error'
}>(), {
  tone: 'info',
})

const rootRef = ref<HTMLElement>()

function focus(): void {
  rootRef.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div
    ref="rootRef"
    :class="['myc-notice', `myc-notice-${props.tone}`]"
    :role="props.tone === 'error' ? 'alert' : 'status'"
    tabindex="-1"
  >
    <span class="myc-notice-mark" aria-hidden="true">{{ props.tone === 'error' ? '✕' : '◆' }}</span>
    <span><slot /></span>
  </div>
</template>
