<script setup lang="ts">
import { splitAroundNumber } from '~/helpers/header'

// Static builds only (no client JS): CSS draws the number between the translated words (header/*.css, #245)
const props = defineProps<{
  percent: number
}>()

const { t } = useI18n()
const MARKER = '\u0001'
const text = computed<[string, string]>(() => splitAroundNumber(t('myc.header.read', { percent: MARKER }), MARKER))
</script>

<template>
  {{ text[0] }}<span class="myc-strip-read-num" :data-percent="props.percent" />{{ text[1] }}
</template>
