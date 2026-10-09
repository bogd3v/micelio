<script setup lang="ts">
import type { StrapiTopic, StrapiTopics } from '~/interfaces'
import { CATEGORIES, CATEGORY_INFO } from '~/helpers/categories'
import { padCount } from '~/helpers/search'

const props = defineProps<{
  block: StrapiTopics
}>()

const { t } = useI18n()
const alsoWriteId = useId()

const topics = computed<StrapiTopic[]>(() =>
  [...(props.block.topics ?? [])].sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category)),
)
const pillars = computed<StrapiTopic[]>(() => topics.value.filter(topic => CATEGORY_INFO[topic.category].pillar))
const others = computed<StrapiTopic[]>(() => topics.value.filter(topic => !CATEGORY_INFO[topic.category].pillar))

// Focusable only where it scrolls (mobile); `display: contents` from 768px leaves nothing to focus
const othersRef = useTemplateRef<HTMLElement>('othersRef')
const scrolls = ref(false)

function measure(): void {
  const element = othersRef.value
  scrolls.value = !!element && element.scrollWidth > element.clientWidth
}

onMounted(measure)
useResizeObserver(othersRef, measure)

function label(topic: StrapiTopic): string {
  const pillar = CATEGORY_INFO[topic.category].pillar
  return pillar
    ? t('home.guide.pillar', { number: padCount(pillar) })
    : padCount(CATEGORIES.indexOf(topic.category) + 1)
}
</script>

<template>
  <section class="myc-home-section myc-reveal" :aria-label="block.title || block.eyebrow || undefined">
    <div v-if="block.eyebrow || block.title || block.intro" class="myc-home-head">
      <div class="myc-home-heading">
        <p v-if="block.eyebrow" class="myc-eyebrow myc-home-eyebrow">{{ block.eyebrow }}</p>
        <h2 v-if="block.title" class="myc-home-title myc-stretch">{{ block.title }}</h2>
      </div>
      <p v-if="block.intro" class="myc-home-intro">{{ block.intro }}</p>
    </div>

    <div class="myc-topic-grid">
      <StrapiTopicCard v-for="topic in pillars" :key="topic.id" :topic="topic" :label="label(topic)" pillar />

      <p v-if="others.length" class="myc-meta myc-topic-more">
        <span :id="alsoWriteId">{{ t('about.alsoWrite') }}</span>
        <span aria-hidden="true">{{ t('about.swipe') }}</span>
      </p>
      <div
        v-if="others.length"
        ref="othersRef"
        class="myc-topic-others"
        :role="scrolls ? 'group' : undefined"
        :tabindex="scrolls ? 0 : undefined"
        :aria-labelledby="scrolls ? alsoWriteId : undefined"
      >
        <StrapiTopicCard v-for="topic in others" :key="topic.id" :topic="topic" :label="label(topic)" />
      </div>
    </div>

    <p v-if="block.footnoteLabel || block.footnote" class="myc-meta myc-topic-footnote">
      <span v-if="block.footnoteLabel">{{ block.footnoteLabel }}</span>
      <span v-if="block.footnote"><span aria-hidden="true">→ </span>{{ block.footnote }}</span>
    </p>
  </section>
</template>
