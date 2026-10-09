<script setup lang="ts">
import type { TextSegment } from '~/interfaces'
import { highlightSegments } from '~/helpers/search'

const props = defineProps<{
  text: string
  query?: string
}>()

const segments = computed<TextSegment[]>(() => highlightSegments(props.text, props.query ?? ''))
</script>

<template>
  <template v-for="(segment, index) in segments" :key="index">
    <mark v-if="segment.match" class="myc-mark">{{ segment.text }}</mark>
    <template v-else>{{ segment.text }}</template>
  </template>
</template>
