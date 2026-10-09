<script setup lang="ts">
import type { FeatureGridSection } from '~/interfaces'

const props = defineProps<{ section: FeatureGridSection }>()

const titleId = useId()
// Items are h3 under the section's h2; without a title they are the h2s
const itemLevel = computed<string>(() => props.section.title ? 'h3' : 'h2')
</script>

<template>
  <section class="myc-section" data-section="feature-grid" :data-variant="section.variant" :aria-labelledby="section.title ? titleId : undefined">
    <div class="myc-section-inner">
      <SectionHead :title="section.title" :text="section.text" :title-id="titleId" />
      <ul class="myc-section-items">
        <li v-for="(item, index) in section.items" :key="index" class="myc-section-item">
          <SectionMedia v-if="item.icon" :media="item.icon" root-class="myc-section-icon" sizes="64px" decorative />
          <component :is="itemLevel" class="myc-section-item-title">{{ item.title }}</component>
          <p v-if="item.text" class="myc-section-item-text">{{ item.text }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>
