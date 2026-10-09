<script setup lang="ts">
import type { Category, FieldGuideTopic, PostListItem } from '~/interfaces'

defineOptions({ name: 'RegionHomeIndex' })

// Same props as the showcase; the index shows no featured article or topic guide
defineProps<{
  featuredPost?: PostListItem
  total: number
  counts: Partial<Record<Category, number>>
  topics: FieldGuideTopic[]
}>()

const { t } = useI18n()
const { localizePath } = useLocaleUtils()
const site = useSite()
const fediverseOn = useModule('fediverse')
const newsletterOn = useModule('newsletter')
</script>

<template>
  <div class="myc-home" data-layout="index">
    <header class="myc-home-lede">
      <h1 class="myc-home-lede-title myc-wide">{{ site.name }}</h1>
      <p v-if="site.description" class="myc-home-lede-text">{{ site.description }}</p>
      <BdButton :href="localizePath('/about')" variant="text" arrow>{{ t('nav.about') }}</BdButton>
    </header>

    <HomeLatest :total="total" :counts="counts" />

    <HomeFediverse v-if="fediverseOn" />

    <HomeSubscribe v-if="newsletterOn" />
  </div>
</template>
