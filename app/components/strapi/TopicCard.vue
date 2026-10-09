<script setup lang="ts">
import type { StrapiTopic } from '~/interfaces'

defineProps<{
  topic: StrapiTopic
  label: string
  pillar?: boolean
}>()

const caption = useIllustrationCaption()
</script>

<template>
  <article :class="['myc-topic', { 'myc-topic-pillar': pillar }]">
    <div class="myc-topic-head">
      <MycCategoryTag :category="topic.category" />
      <span class="myc-meta myc-topic-label">{{ label }}</span>
    </div>
    <div class="myc-topic-art"><ThemeIllustration :category="topic.category" :size="200" /></div>
    <h3 class="myc-topic-title myc-wide">{{ topic.title }}</h3>
    <p v-if="topic.description" class="myc-topic-text">{{ topic.description }}</p>
    <p v-if="caption(topic.category)" class="myc-topic-bird">
      {{ caption(topic.category)!.name }} · <i>{{ caption(topic.category)!.scientific }}</i>
    </p>
  </article>
</template>
