<script setup lang="ts">
import type { Category, PostListItem, PostMonth } from '~/interfaces'
import { groupPostsByMonth } from '~/helpers/blog'
import { isCategory } from '~/helpers/categories'
import { formatDotDate } from '~/helpers/formatDate'
import { padCount } from '~/helpers/search'

const props = defineProps<{
  posts: PostListItem[]
  federated?: boolean
  highlight?: string
}>()

const { t, locale } = useI18n()
const { localizePath } = useLocaleUtils()
const { isRead } = useReadArticles()

const postStats = usePostStats(toRef(props, 'posts'), toRef(props, 'federated'))

const months = computed<PostMonth[]>(() => groupPostsByMonth(props.posts, locale.value))

function countLabel(month: PostMonth): string {
  return t('blog.log.count', { count: padCount(month.posts.length) }, month.posts.length)
}

function postHref(post: PostListItem): string {
  return `${localizePath('/blog')}/${post.slug}`
}

function postCategory(post: PostListItem): Category | undefined {
  const slug = post.category?.slug
  return isCategory(slug) ? slug : undefined
}
</script>

<template>
  <div class="myc-log">
    <section v-for="month in months" :key="month.key" class="myc-log-month" :aria-labelledby="`myc-log-${month.key}`">
      <header class="myc-log-month-head">
        <h2 :id="`myc-log-${month.key}`" class="myc-eyebrow myc-log-month-title">{{ month.label }}</h2>
        <span class="myc-meta myc-log-month-count">{{ countLabel(month) }}</span>
      </header>
      <ul class="myc-log-list">
        <li v-for="post in month.posts" :key="post.id" class="myc-log-row">
          <time class="myc-meta myc-log-date" :datetime="post.publishedAt ?? undefined">{{ formatDotDate(post.publishedAt) }}</time>
          <span class="myc-log-category">
            <MycCategoryTag v-if="postCategory(post)" :category="postCategory(post)!" />
          </span>
          <span class="myc-log-text">
            <NuxtLink :to="postHref(post)" class="myc-log-link">{{ post.title }}</NuxtLink>
            <span v-if="post.snippet" class="myc-log-excerpt"><MycHighlight :text="post.snippet" :query="highlight" /></span>
            <span v-else-if="post.description" class="myc-log-excerpt">{{ post.description }}</span>
          </span>
          <span class="myc-meta myc-log-meta">
            <span v-if="postStats(post)" class="myc-log-stats">
              <span aria-hidden="true">◆</span>
              {{ postStats(post)!.likes }} {{ t('post.fediverse.likes', postStats(post)!.likes) }}
              · {{ postStats(post)!.boosts }} {{ t('post.fediverse.boosts', postStats(post)!.boosts) }}
            </span>
            <span v-if="isRead(post.documentId)" class="myc-read-mark"><span aria-hidden="true">✓</span> {{ t('myc.card.read') }}</span>
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>
