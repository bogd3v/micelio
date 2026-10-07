<script setup lang="ts">
import type { StatsSection } from '~/interfaces'

defineProps<{ section: StatsSection }>()

const titleId = useId()
</script>

<template>
  <section class="bd-section" data-section="stats" :data-variant="section.variant" :aria-labelledby="section.title ? titleId : undefined">
    <div class="bd-section-inner">
      <SectionHead :title="section.title" :title-id="titleId" />
      <dl class="bd-section-items">
        <div v-for="(item, index) in section.items" :key="index" class="bd-section-item">
          <dt class="bd-section-stat-value">{{ item.value }}</dt>
          <dd class="bd-section-stat-label">{{ item.label }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>
