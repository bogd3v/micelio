<script setup lang="ts">
const props = withDefaults(defineProps<{
  /** Slug of a category of the CMS; its name and color come from `useCategories()` */
  category: string
  /** The name the post came with; shown when the CMS list does not have the category */
  name?: string
  href?: string
}>(), {
  name: undefined,
  href: undefined,
})

const { categories, colorOf, labelOf } = useCategories()

const label = computed<string>(() => categories.value.some(item => item.slug === props.category) ? labelOf(props.category) : (props.name || props.category))
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
