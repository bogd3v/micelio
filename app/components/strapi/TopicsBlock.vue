<script setup lang="ts">
import type { StrapiTopic, StrapiTopics } from '~/interfaces'
import { padCount } from '~/helpers/search'

const props = defineProps<{
  block: StrapiTopics
}>()

const { t } = useI18n()
const alsoWriteId = useId()

const { categories } = useCategories()

// The topics follow the order of the CMS list; one whose category the list does not have goes last, in the block's order
const topics = computed<StrapiTopic[]>(() => {
  const rank = (slug: string): number => {
    const index = categories.value.findIndex(category => category.slug === slug)
    return index === -1 ? categories.value.length : index
  }
  return [...(props.block.topics ?? [])].sort((a, b) => rank(a.category) - rank(b.category))
})
const isPillar = (topic: StrapiTopic): boolean => Boolean(categories.value.find(category => category.slug === topic.category)?.featured)
const pillars = computed<StrapiTopic[]>(() => topics.value.filter(isPillar))
const others = computed<StrapiTopic[]>(() => topics.value.filter(topic => !isPillar(topic)))

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
  const pillar = pillars.value.indexOf(topic)
  // The others count on from the pillars, so the numbers run 01, 02, 03 in the order the cards appear
  return pillar === -1
    ? padCount(pillars.value.length + others.value.indexOf(topic) + 1)
    : t('home.guide.pillar', { number: padCount(pillar + 1) })
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
