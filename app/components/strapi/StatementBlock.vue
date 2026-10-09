<script setup lang="ts">
import type { StrapiStatement } from '~/interfaces'

defineProps<{
  block: StrapiStatement
}>()
</script>

<template>
  <section class="myc-home-section myc-about-split myc-reveal">
    <p v-if="block.eyebrow" class="myc-eyebrow myc-home-eyebrow myc-about-split-label">{{ block.eyebrow }}</p>
    <div class="myc-about-split-body">
      <p class="myc-statement myc-wide">{{ block.statement }}</p>
      <p v-if="block.body" class="myc-statement-body">{{ block.body }}</p>
    </div>
  </section>
</template>
