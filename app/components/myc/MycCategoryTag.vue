<script setup lang="ts">
import type { Category } from '~/interfaces'

const props = withDefaults(defineProps<{
  category: Category
  href?: string
}>(), {
  href: undefined,
})

const { t } = useI18n()

const label = computed<string>(() => t(`myc.categories.${props.category}`))
const classes = computed<string[]>(() => ['myc-tag', `myc-tag-${props.category}`])
</script>

<template>
  <NuxtLink v-if="href" :to="href" :class="classes">
    <span class="myc-tag-dot" aria-hidden="true" />
    <span><slot>{{ label }}</slot></span>
  </NuxtLink>
  <span v-else :class="classes">
    <span class="myc-tag-dot" aria-hidden="true" />
    <span><slot>{{ label }}</slot></span>
  </span>
</template>
