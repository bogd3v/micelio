<script setup lang="ts">
const props = withDefaults(defineProps<{
  /** Slug of a category of the CMS; its name and color come from `useCategories()` */
  category: string
  href?: string
}>(), {
  href: undefined,
})

const { colorOf, labelOf } = useCategories()

const label = computed<string>(() => labelOf(props.category))
const style = computed<Record<string, string>>(() => ({ '--tag-color': colorOf(props.category) }))
</script>

<template>
  <NuxtLink v-if="href" :to="href" class="myc-tag" :style="style">
    <span class="myc-tag-dot" aria-hidden="true" />
    <span><slot>{{ label }}</slot></span>
  </NuxtLink>
  <span v-else class="myc-tag" :style="style">
    <span class="myc-tag-dot" aria-hidden="true" />
    <span><slot>{{ label }}</slot></span>
  </span>
</template>
