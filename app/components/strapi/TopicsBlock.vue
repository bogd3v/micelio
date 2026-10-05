<script setup lang="ts">
import type { StrapiTopic, StrapiTopics } from '~/interfaces'
import { CATEGORIES, CATEGORY_INFO } from '~/helpers/categories'
import { padCount } from '~/helpers/search'

const props = defineProps<{
  block: StrapiTopics
}>()

const { t } = useI18n()

const topics = computed<StrapiTopic[]>(() =>
  [...(props.block.topics ?? [])].sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category)),
)
const pillars = computed<StrapiTopic[]>(() => topics.value.filter(topic => CATEGORY_INFO[topic.category].pillar))
const others = computed<StrapiTopic[]>(() => topics.value.filter(topic => !CATEGORY_INFO[topic.category].pillar))

function label(topic: StrapiTopic): string {
  const pillar = CATEGORY_INFO[topic.category].pillar
  return pillar
    ? t('home.guide.pillar', { number: padCount(pillar) })
    : padCount(CATEGORIES.indexOf(topic.category) + 1)
}
</script>

<template>
  <section class="bd-home-section bd-reveal" :aria-label="block.title || block.eyebrow || undefined">
    <div v-if="block.eyebrow || block.title || block.intro" class="bd-home-head">
      <div class="bd-home-heading">
        <p v-if="block.eyebrow" class="bd-eyebrow bd-home-eyebrow">{{ block.eyebrow }}</p>
        <h2 v-if="block.title" class="bd-home-title bd-stretch">{{ block.title }}</h2>
      </div>
      <p v-if="block.intro" class="bd-home-intro">{{ block.intro }}</p>
    </div>

    <div class="bd-topic-grid">
      <StrapiTopicCard v-for="topic in pillars" :key="topic.id" :topic="topic" :label="label(topic)" pillar />

      <p v-if="others.length" class="bd-meta bd-topic-more">
        <span>{{ t('about.alsoWrite') }}</span>
        <span aria-hidden="true">{{ t('about.swipe') }}</span>
      </p>
      <div v-if="others.length" class="bd-topic-others">
        <StrapiTopicCard v-for="topic in others" :key="topic.id" :topic="topic" :label="label(topic)" />
      </div>
    </div>

    <p v-if="block.footnoteLabel || block.footnote" class="bd-meta bd-topic-footnote">
      <span v-if="block.footnoteLabel">{{ block.footnoteLabel }}</span>
      <span v-if="block.footnote"><span aria-hidden="true">→ </span>{{ block.footnote }}</span>
    </p>
  </section>
</template>
