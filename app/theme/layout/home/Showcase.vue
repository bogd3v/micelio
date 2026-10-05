<script setup lang="ts">
import type { Category, FieldGuideTopic, PostListItem } from '~/interfaces'

defineOptions({ name: 'RegionHomeShowcase' })

defineProps<{
  featuredPost?: PostListItem
  total: number
  counts: Partial<Record<Category, number>>
  topics: FieldGuideTopic[]
}>()

const { t } = useI18n()
const toPostCard = usePostCard()
const fediverseOn = useModule('fediverse')
const newsletterOn = useModule('newsletter')
</script>

<template>
  <div class="bd-home" data-layout="showcase">
    <HomeHero :total="total" />

    <section v-if="featuredPost" class="bd-home-featured bd-reveal" :aria-label="t('bd.card.featured')">
      <BdPostCard v-bind="toPostCard(featuredPost)" featured priority />
    </section>

    <HomeLatest :total="total" :counts="counts" />

    <HomeFieldGuide :topics="topics" />

    <HomeFediverse v-if="fediverseOn" />

    <HomeSubscribe v-if="newsletterOn" />
  </div>
</template>
