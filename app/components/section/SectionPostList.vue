<script setup lang="ts">
import type { PostListSection } from '~/interfaces'
import { formatDotDate } from '~/helpers/formatDate'

const props = defineProps<{ section: PostListSection }>()

const { localizePath } = useLocaleUtils()
const toPostCard = usePostCard()
const titleId = useId()

const posts = computed(() => props.section.posts ?? [])
</script>

<template>
  <section v-if="posts.length" class="bd-section" data-section="post-list" :data-variant="section.variant" :aria-labelledby="section.title ? titleId : undefined">
    <div class="bd-section-inner">
      <SectionHead :title="section.title" :title-id="titleId" />
      <ul v-if="section.variant === 'list'" class="bd-section-items">
        <li v-for="post in posts" :key="post.id" class="bd-section-item">
          <time v-if="post.publishedAt" class="bd-meta" :datetime="post.publishedAt">{{ formatDotDate(post.publishedAt) }}</time>
          <h3 class="bd-section-item-title">
            <NuxtLink :to="`${localizePath('/blog')}/${post.slug}`">{{ post.title }}</NuxtLink>
          </h3>
          <p v-if="post.description" class="bd-section-item-text">{{ post.description }}</p>
        </li>
      </ul>
      <ul v-else class="bd-section-items">
        <li v-for="post in posts" :key="post.id" class="bd-section-item">
          <BdPostCard v-bind="toPostCard(post)" />
        </li>
      </ul>
    </div>
  </section>
</template>
