<script setup lang="ts">
// The template has one branch per shape, so a head without the eyebrow or the anchor renders as it did before: no placeholder, no wrapper around the title
withDefaults(defineProps<{
  title?: string | null
  text?: string | null
  /** short label above the title */
  eyebrow?: string | null
  /** explicit anchor: the id of the heading and the target of its self-link; the heading keeps `titleId` without one */
  anchor?: string | null
  /** id of the heading when there is no anchor, for aria-labelledby on the section */
  titleId: string
  /** 1 for the title that names the page, 2 otherwise */
  level?: 1 | 2
}>(), { level: 2 })
</script>

<template>
  <div v-if="eyebrow" class="myc-section-head">
    <p class="myc-eyebrow">{{ eyebrow }}</p>
    <component :is="`h${level}`" v-if="title && anchor" :id="anchor" class="myc-section-title"><a :href="`#${anchor}`">{{ title }}</a></component>
    <component :is="`h${level}`" v-else-if="title" :id="titleId" class="myc-section-title">{{ title }}</component>
    <p v-if="text" class="myc-section-text">{{ text }}</p>
  </div>
  <div v-else-if="title || text" class="myc-section-head">
    <component :is="`h${level}`" v-if="title && anchor" :id="anchor" class="myc-section-title"><a :href="`#${anchor}`">{{ title }}</a></component>
    <component :is="`h${level}`" v-else-if="title" :id="titleId" class="myc-section-title">{{ title }}</component>
    <p v-if="text" class="myc-section-text">{{ text }}</p>
  </div>
</template>
