<script setup lang="ts">
withDefaults(defineProps<{
  open?: boolean
}>(), {
  open: false,
})

const emit = defineEmits<{
  menu: []
}>()

const { isStatic, menuId } = useStaticSite()
</script>

<template>
  <a v-if="isStatic" :href="`#${menuId}`">
    <slot />
  </a>
  <button
    v-else
    type="button"
    aria-haspopup="dialog"
    :aria-expanded="open ? 'true' : 'false'"
    @click="emit('menu')"
  >
    <slot />
  </button>
</template>
