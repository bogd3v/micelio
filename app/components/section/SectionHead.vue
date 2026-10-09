<script setup lang="ts">
withDefaults(defineProps<{
  title?: string | null
  text?: string | null
  /** id of the heading, for aria-labelledby on the section */
  titleId: string
  /** 1 for the title that names the page, 2 otherwise */
  level?: 1 | 2
}>(), { level: 2 })
</script>

<template>
  <div v-if="title || text" class="myc-section-head">
    <component :is="`h${level}`" v-if="title" :id="titleId" class="myc-section-title">{{ title }}</component>
    <p v-if="text" class="myc-section-text">{{ text }}</p>
  </div>
</template>
