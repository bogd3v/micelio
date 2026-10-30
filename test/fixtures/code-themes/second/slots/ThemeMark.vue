<template>
  <span :class="['second-mark', `second-mark-${context ?? 'header'}`]" />
</template>

<script setup lang="ts">
defineProps<{ context?: 'header' | 'footer' }>()
</script>
