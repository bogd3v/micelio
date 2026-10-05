<script setup lang="ts">
import type { FieldGuideTopic } from '~/interfaces'

defineProps<{
  topics: FieldGuideTopic[]
}>()

const themeMessage = useThemeMessage()
</script>

<template>
  <section class="bd-home-section bd-reveal" aria-labelledby="guide-title">
    <div class="bd-home-head">
      <div class="bd-home-heading">
        <p class="bd-eyebrow bd-home-eyebrow">{{ themeMessage('guide.eyebrow', 'home.guide.eyebrow') }}</p>
        <h2 id="guide-title" class="bd-home-title bd-stretch">{{ themeMessage('guide.title', 'home.guide.title') }}</h2>
      </div>
      <p class="bd-home-intro bd-guide-intro">{{ themeMessage('guide.description', 'home.guide.description') }}</p>
    </div>
    <div class="bd-guide-grid">
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
