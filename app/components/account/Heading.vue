<script setup lang="ts">
defineProps<{
  eyebrow: string
  title: string
}>()

const titleRef = ref<HTMLElement>()

function focus(): void {
  titleRef.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div class="myc-account-heading">
    <p class="myc-eyebrow">{{ eyebrow }}</p>
    <h1 ref="titleRef" class="myc-account-title myc-wide" tabindex="-1">{{ title }}</h1>
    <p v-if="$slots.default" class="myc-account-lead"><slot /></p>
  </div>
</template>
