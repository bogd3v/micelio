<script setup lang="ts">
defineProps<{
  title?: string | null
  text?: string | null
  /** id of the heading, for aria-labelledby on the section */
  titleId: string
}>()
</script>

<template>
  <div v-if="title || text" class="bd-section-head">
    <h2 v-if="title" :id="titleId" class="bd-section-title">{{ title }}</h2>
    <p v-if="text" class="bd-section-text">{{ text }}</p>
  </div>
</template>
