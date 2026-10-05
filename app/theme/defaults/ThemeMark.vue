<script setup lang="ts">
// Core default (ADR 0005, section 4): the site name as text
defineProps<{
  size?: number
  context?: 'header' | 'footer'
}>()

const site = useSite()
</script>

<template>
  <span aria-hidden="true">{{ site.name }}</span>
</template>
