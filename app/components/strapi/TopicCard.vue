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
  <article :class="['bd-topic', { 'bd-topic-pillar': pillar }]">
    <div class="bd-topic-head">
      <BdCategoryTag :category="topic.category" />
      <span class="bd-meta bd-topic-label">{{ label }}</span>
    </div>
    <div class="bd-topic-art"><ThemeIllustration :category="topic.category" :size="200" /></div>
    <h3 class="bd-topic-title bd-wide">{{ topic.title }}</h3>
    <p v-if="topic.description" class="bd-topic-text">{{ topic.description }}</p>
    <p v-if="caption(topic.category)" class="bd-topic-bird">
      {{ caption(topic.category)!.name }} · <i>{{ caption(topic.category)!.scientific }}</i>
    </p>
  </article>
</template>
