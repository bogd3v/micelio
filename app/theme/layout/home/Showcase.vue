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
  <div class="myc-home" data-layout="showcase">
    <HomeHero :total="total" />

    <section v-if="featuredPost" class="myc-home-featured myc-reveal" :aria-label="t('myc.card.featured')">
      <MycPostCard v-bind="toPostCard(featuredPost)" featured priority />
    </section>

    <HomeLatest :featured-slug="featuredPost?.slug" :total="total" :counts="counts" />

    <HomeFieldGuide :topics="topics" />

    <HomeFediverse v-if="fediverseOn" />

    <HomeSubscribe v-if="newsletterOn" />
  </div>
</template>
