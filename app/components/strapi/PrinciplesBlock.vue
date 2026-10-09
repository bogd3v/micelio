<script setup lang="ts">
import type { StrapiPrinciples } from '~/interfaces'
import { padCount } from '~/helpers/search'

defineProps<{
  block: StrapiPrinciples
}>()
</script>

<template>
  <section class="myc-home-section myc-reveal" :aria-label="block.title || block.eyebrow || undefined">
    <div v-if="block.eyebrow || block.title" class="myc-home-heading">
      <p v-if="block.eyebrow" class="myc-eyebrow myc-home-eyebrow">{{ block.eyebrow }}</p>
      <h2 v-if="block.title" class="myc-home-title myc-stretch">{{ block.title }}</h2>
    </div>
    <ol v-if="block.principles?.length" class="myc-principles">
      <li v-for="(principle, index) in block.principles" :key="principle.id" class="myc-principle">
        <span class="myc-principle-number" aria-hidden="true">{{ padCount(index + 1) }}</span>
        <h3 v-if="principle.title" class="myc-principle-title myc-wide">{{ principle.title }}</h3>
        <p class="myc-principle-text">{{ principle.text }}</p>
      </li>
    </ol>
  </section>
</template>
