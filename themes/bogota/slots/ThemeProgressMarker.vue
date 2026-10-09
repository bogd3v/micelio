<script setup lang="ts">
// The bird rides the track by the --myc-read custom property of .myc-progress (CSS only), so `progress` is not read
defineProps<{
  progress?: number
}>()
</script>

<template>
  <div class="myc-progress-track">
    <svg class="bogota-progress-bird" width="22" height="14" viewBox="0 0 22 14" focusable="false">
      <path class="bogota-wing" d="M1 9 Q6 1 11 8 Q16 1 21 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </div>
</template>
