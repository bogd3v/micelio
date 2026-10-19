<script setup lang="ts">
import type { FieldGuideTopic } from '~/interfaces'

const props = defineProps<{
  topics: FieldGuideTopic[]
}>()

const themeMessage = useThemeMessage()
const { categories } = useCategories()

// The featured categories are the pillars, numbered 1, 2… in the order the guide shows them
const pillars = computed<Record<string, number>>(() => {
  const featured = new Set(categories.value.filter(category => category.featured).map(category => category.slug))
  return Object.fromEntries(props.topics.filter(topic => featured.has(topic.category)).map((topic, index) => [topic.category, index + 1]))
})
</script>

<template>
  <section v-if="topics.length" class="myc-home-section myc-reveal" aria-labelledby="guide-title">
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
        :pillar="pillars[topic.category]"
        :figure="index"
      />
    </div>
  </section>
</template>
