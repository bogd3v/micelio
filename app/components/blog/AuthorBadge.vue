<script setup lang="ts">
import type { StrapiAuthorRef } from '~/interfaces'
import { initials } from '~/helpers/string'

const props = withDefaults(defineProps<{
  author?: StrapiAuthorRef | null
  size?: 'md' | 'lg'
}>(), {
  author: undefined,
  size: 'md',
})

const { getMediaUrl } = useStrapi()

const avatarUrl = computed<string>(() => (props.author?.avatar?.url ? getMediaUrl(props.author.avatar.url) : ''))
const pixels = computed<number>(() => (props.size === 'lg' ? 64 : 44))
</script>

<template>
  <span :class="['myc-avatar', `myc-avatar-${size}`]" aria-hidden="true">
    <NuxtImg
      v-if="avatarUrl"
      :src="avatarUrl"
      alt=""
      :width="pixels"
      :height="pixels"
      format="webp"
      loading="lazy"
      decoding="async"
    />
    <template v-else>{{ initials(author?.name) }}</template>
  </span>
</template>
