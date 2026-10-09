<script setup lang="ts">
import type { StatsSection } from '~/interfaces'

defineProps<{ section: StatsSection }>()

const titleId = useId()
</script>

<template>
  <section class="myc-section" data-section="stats" :data-variant="section.variant" :aria-labelledby="section.title ? titleId : undefined">
    <div class="myc-section-inner">
      <SectionHead :title="section.title" :title-id="titleId" />
      <dl class="myc-section-items">
        <div v-for="(item, index) in section.items" :key="index" class="myc-section-item">
          <dt class="myc-section-stat-value">{{ item.value }}</dt>
          <dd class="myc-section-stat-label">{{ item.label }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>
