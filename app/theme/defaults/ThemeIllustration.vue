<script setup lang="ts">
import type { Category } from '~/interfaces'

// Core default: no illustration
defineProps<{
  category: Category
  size?: number
}>()
</script>

<template>
  <span aria-hidden="true" />
</template>
