<script setup lang="ts">
import type { FeatureGridSection } from '~/interfaces'

defineProps<{ section: FeatureGridSection }>()

const titleId = useId()
</script>

<template>
  <section class="bd-section" data-section="feature-grid" :data-variant="section.variant" :aria-labelledby="section.title ? titleId : undefined">
    <div class="bd-section-inner">
      <SectionHead :title="section.title" :text="section.text" :title-id="titleId" />
      <ul class="bd-section-items">
        <li v-for="(item, index) in section.items" :key="index" class="bd-section-item">
          <SectionMedia v-if="item.icon" :media="item.icon" root-class="bd-section-icon" sizes="64px" decorative />
          <h3 class="bd-section-item-title">{{ item.title }}</h3>
          <p v-if="item.text" class="bd-section-item-text">{{ item.text }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>
