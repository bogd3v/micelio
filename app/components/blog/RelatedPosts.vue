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
  <section v-if="post || newsletterOn" class="bd-home-section bd-related bd-reveal" :aria-labelledby="post ? 'bd-related-title' : undefined">
    <div v-if="post" class="bd-home-heading">
      <p class="bd-eyebrow bd-home-eyebrow">{{ t('post.keepReading') }}</p>
      <h2 id="bd-related-title" class="bd-home-title bd-stretch">
        {{ t('post.alsoIn', { category: categoryLabel(category) }) }}
      </h2>
    </div>
    <div :class="['bd-related-grid', { 'bd-related-solo': !post }]">
      <BdPostCard v-if="post" v-bind="toPostCard(post)" />
      <BdNewsletterForm v-if="newsletterOn" id="nl-article" class="bd-related-news" />
    </div>
  </section>
</template>
