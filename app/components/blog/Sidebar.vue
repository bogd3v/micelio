<script setup lang="ts">
import type { Category, PostListItem } from '~/interfaces'
import { formatDotDate } from '~/helpers/formatDate'
import { padCount } from '~/helpers/search'
import { CATEGORIES } from '~/helpers/categories'
import { feedPath } from '~/helpers/feed'

defineProps<{
  recentPosts: PostListItem[]
  category?: Category
}>()

const { t, locale } = useI18n()
const { localizePath } = useLocaleUtils()
const fediverseUser = useFediverseUser()
const fediverseOn = useModule('fediverse')
const { count: readCount, clear: clearRead } = useReadArticles()

const cleared = ref(false)

const readLabel = computed<string>(() => t('blog.read.count', { count: padCount(readCount.value) }, readCount.value))

function clearHistory(): void {
  clearRead()
  cleared.value = true
}
</script>

<template>
  <aside class="bd-blog-aside" :aria-label="t('blog.aside')">
    <BlogReadingPath v-if="category" :key="category" :category="category" />
    <section v-if="recentPosts.length" class="bd-blog-aside-group" aria-labelledby="bd-blog-recent">
      <h2 id="bd-blog-recent" class="bd-eyebrow bd-home-eyebrow">{{ t('blog.recent') }}</h2>
      <NuxtLink
        v-for="post in recentPosts"
        :key="post.id"
        :to="`${localizePath('/blog')}/${post.slug}`"
        class="bd-blog-recent"
      >
        <time class="bd-meta" :datetime="post.publishedAt ?? undefined">{{ formatDotDate(post.publishedAt) }}</time>
        <span class="bd-blog-recent-title">{{ post.title }}</span>
      </NuxtLink>
    </section>
    <section v-if="readCount > 0 || cleared" class="bd-blog-aside-group" aria-labelledby="bd-blog-read">
      <h2 id="bd-blog-read" class="bd-eyebrow bd-home-eyebrow">{{ t('blog.read.title') }}</h2>
      <p class="bd-meta bd-blog-read-note" role="status">{{ cleared && readCount === 0 ? t('blog.read.cleared') : readLabel }}</p>
      <button v-if="readCount > 0" type="button" class="bd-blog-textbtn" @click="clearHistory">{{ t('blog.read.clear') }}</button>
    </section>
    <section class="bd-blog-aside-group" aria-labelledby="bd-blog-subscribe">
      <h2 id="bd-blog-subscribe" class="bd-eyebrow bd-home-eyebrow">{{ t('bd.footer.subscribe') }}</h2>
      <a :href="feedPath(locale)" class="bd-blog-aside-link" target="_blank" rel="noopener noreferrer">{{ t('blog.rss') }} <span aria-hidden="true">↗</span></a>
      <div class="bd-blog-feeds">
        <p id="bd-blog-feeds-label" class="bd-blog-feeds-label">{{ t('blog.feeds.label') }}</p>
        <ul class="bd-meta bd-blog-feeds-list" aria-labelledby="bd-blog-feeds-label">
          <li v-for="slug in CATEGORIES" :key="slug">
            <a
              :href="feedPath(locale, slug)"
              class="bd-blog-feed-link"
              target="_blank"
              rel="noopener noreferrer"
              :aria-label="t('blog.feeds.aria', { category: t(`bd.categoryShort.${slug}`) })"
            >
              {{ t(`bd.categoryShort.${slug}`) }} <span aria-hidden="true">↗</span>
            </a>
          </li>
        </ul>
      </div>
      <NuxtLink v-if="fediverseOn" :to="`${localizePath('/')}#fediverso`" class="bd-blog-aside-link">
        <span class="bd-hero-diamond" aria-hidden="true">◆</span> {{ t('blog.fediverse', { handle: fediverseUser }) }}
      </NuxtLink>
    </section>
  </aside>
</template>
