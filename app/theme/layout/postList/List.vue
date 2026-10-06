<script setup lang="ts">
import type { Category, PostListItem } from '~/interfaces'
import { isCategory } from '~/helpers/categories'
import { formatDotDate } from '~/helpers/formatDate'

defineOptions({ name: 'RegionPostListList' })

// `view` keeps the props of every variant alike; this one always renders rows
const props = defineProps<{
  posts: PostListItem[]
  view: 'grid' | 'log'
  federated: boolean
  highlight?: string
}>()

const { t } = useI18n()
const { localizePath } = useLocaleUtils()
const { isRead } = useReadArticles()
const postStats = usePostStats(toRef(props, 'posts'), toRef(props, 'federated'))

function postCategory(post: PostListItem): Category | undefined {
  const slug = post.category?.slug
  return isCategory(slug) ? slug : undefined
}
</script>

<template>
  <div data-layout="list">
    <h2 class="bd-sr">{{ t("blog.listTitle") }}</h2>
    <ol class="bd-post-rows">
      <li v-for="post in posts" :key="post.id" class="bd-post-row">
        <time class="bd-meta bd-post-row-date" :datetime="post.publishedAt ?? undefined">{{ formatDotDate(post.publishedAt) }}</time>
        <div class="bd-post-row-text">
          <h3 class="bd-post-row-title">
            <NuxtLink :to="`${localizePath('/blog')}/${post.slug}`" class="bd-post-row-link">{{ post.title }}</NuxtLink>
          </h3>
          <p v-if="post.snippet" class="bd-post-row-excerpt"><BdHighlight :text="post.snippet" :query="highlight" /></p>
          <p v-else-if="post.description" class="bd-post-row-excerpt">{{ post.description }}</p>
        </div>
        <div class="bd-meta bd-post-row-meta">
          <BdCategoryTag v-if="postCategory(post)" :category="postCategory(post)!" />
          <span v-if="postStats(post)">
            <span aria-hidden="true">◆</span>
            {{ postStats(post)!.likes }} {{ t('post.fediverse.likes', postStats(post)!.likes) }}
            · {{ postStats(post)!.boosts }} {{ t('post.fediverse.boosts', postStats(post)!.boosts) }}
          </span>
          <span v-if="isRead(post.documentId)" class="bd-read-mark"><span aria-hidden="true">✓</span> {{ t('bd.card.read') }}</span>
        </div>
      </li>
    </ol>
  </div>
</template>
