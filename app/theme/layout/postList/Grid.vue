<script setup lang="ts">
import type { PostListItem } from '~/interfaces'

defineOptions({ name: 'RegionPostListGrid' })

defineProps<{
  posts: PostListItem[]
  view: 'grid' | 'log'
  federated: boolean
  highlight?: string
}>()

const { t } = useI18n()
const toPostCard = usePostCard()
</script>

<template>
  <div data-layout="grid">
    <BlogLog v-if="view === 'log'" :posts="posts" :federated="federated" :highlight="highlight" />
    <template v-else>
      <h2 class="myc-sr">{{ t("blog.listTitle") }}</h2>
      <div class="myc-blog-grid">
        <MycPostCard
          v-for="(post, index) in posts"
          :key="post.id"
          v-bind="toPostCard(post)"
          :highlight="highlight"
          :priority="index === 0"
        />
      </div>
    </template>
  </div>
</template>
