<script setup lang="ts">
import type { Locale, PostListItem, StrapiCategoryRef } from '~/interfaces'

const props = defineProps<{
  currentPostId: number
  category?: StrapiCategoryRef | null
}>()

const { locale, t } = useI18n()
const { fetchPosts } = useStrapi()
const categoryLabel = useCategoryLabel()
const newsletterOn = useModule('newsletter')
const toPostCard = usePostCard()

const { data: related } = fetchPosts({
  pageSize: 2,
  locale: locale.value as Locale,
  category: props.category?.slug ?? undefined,
})

const post = computed<PostListItem | undefined>(() =>
  props.category?.slug ? related.value?.data.find(item => item.id !== props.currentPostId) : undefined,
)
</script>

<template>
  <section v-if="post || newsletterOn" class="myc-home-section myc-related myc-reveal" :aria-labelledby="post ? 'myc-related-title' : undefined">
    <div v-if="post" class="myc-home-heading">
      <p class="myc-eyebrow myc-home-eyebrow">{{ t('post.keepReading') }}</p>
      <h2 id="myc-related-title" class="myc-home-title myc-stretch">
        {{ t('post.alsoIn', { category: categoryLabel(category) }) }}
      </h2>
    </div>
    <div :class="['myc-related-grid', { 'myc-related-solo': !post }]">
      <MycPostCard v-if="post" v-bind="toPostCard(post)" />
      <MycNewsletterForm v-if="newsletterOn" id="nl-article" class="myc-related-news" />
    </div>
  </section>
</template>
