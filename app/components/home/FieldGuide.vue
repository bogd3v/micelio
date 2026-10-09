<script setup lang="ts">
import type { FieldGuideTopic } from '~/interfaces'

defineProps<{
  topics: FieldGuideTopic[]
}>()

const themeMessage = useThemeMessage()
</script>

<template>
  <section class="myc-home-section myc-reveal" aria-labelledby="guide-title">
    <div class="myc-home-head">
      <div class="myc-home-heading">
        <p class="myc-eyebrow myc-home-eyebrow">{{ themeMessage('guide.eyebrow', 'home.guide.eyebrow') }}</p>
        <h2 id="guide-title" class="myc-home-title myc-stretch">{{ themeMessage('guide.title', 'home.guide.title') }}</h2>
      </div>
      <p class="myc-home-intro myc-guide-intro">{{ themeMessage('guide.description', 'home.guide.description') }}</p>
    </div>
    <div class="myc-guide-grid">
      <HomeFieldGuideCard
        v-for="(topic, index) in topics"
        :key="topic.category"
        :category="topic.category"
        :count="topic.count"
        :figure="index"
      />
    </div>
  </section>
</template>
