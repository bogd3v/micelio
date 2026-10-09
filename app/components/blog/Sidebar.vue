<script setup lang="ts">
import type { Category, PostListItem } from '~/interfaces'
import { formatDotDate } from '~/helpers/formatDate'
import { padCount } from '~/helpers/search'
import { CATEGORIES } from '~/constants/categories'
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
  <aside class="myc-blog-aside" :aria-label="t('blog.aside')">
    <BlogReadingPath v-if="category" :key="category" :category="category" />
    <section v-if="recentPosts.length" class="myc-blog-aside-group" aria-labelledby="myc-blog-recent">
      <h2 id="myc-blog-recent" class="myc-eyebrow myc-home-eyebrow">{{ t('blog.recent') }}</h2>
      <NuxtLink
        v-for="post in recentPosts"
        :key="post.id"
        :to="`${localizePath('/blog')}/${post.slug}`"
        class="myc-blog-recent"
      >
        <time class="myc-meta" :datetime="post.publishedAt ?? undefined">{{ formatDotDate(post.publishedAt) }}</time>
        <span class="myc-blog-recent-title">{{ post.title }}</span>
      </NuxtLink>
    </section>
    <section v-if="readCount > 0 || cleared" class="myc-blog-aside-group" aria-labelledby="myc-blog-read">
      <h2 id="myc-blog-read" class="myc-eyebrow myc-home-eyebrow">{{ t('blog.read.title') }}</h2>
      <p class="myc-meta myc-blog-read-note" role="status">{{ cleared && readCount === 0 ? t('blog.read.cleared') : readLabel }}</p>
      <button v-if="readCount > 0" type="button" class="myc-blog-textbtn" @click="clearHistory">{{ t('blog.read.clear') }}</button>
    </section>
    <section class="myc-blog-aside-group" aria-labelledby="myc-blog-subscribe">
      <h2 id="myc-blog-subscribe" class="myc-eyebrow myc-home-eyebrow">{{ t('myc.footer.subscribe') }}</h2>
      <a :href="feedPath(locale)" class="myc-blog-aside-link" target="_blank" rel="noopener noreferrer">{{ t('blog.rss') }} <span aria-hidden="true">↗</span></a>
      <div class="myc-blog-feeds">
        <p id="myc-blog-feeds-label" class="myc-blog-feeds-label">{{ t('blog.feeds.label') }}</p>
        <ul class="myc-meta myc-blog-feeds-list" aria-labelledby="myc-blog-feeds-label">
          <li v-for="slug in CATEGORIES" :key="slug">
            <a
              :href="feedPath(locale, slug)"
              class="myc-blog-feed-link"
              target="_blank"
              rel="noopener noreferrer"
              :aria-label="t('blog.feeds.aria', { category: t(`myc.categoryShort.${slug}`) })"
            >
              {{ t(`myc.categoryShort.${slug}`) }} <span aria-hidden="true">↗</span>
            </a>
          </li>
        </ul>
      </div>
      <NuxtLink v-if="fediverseOn" :to="`${localizePath('/')}#fediverso`" class="myc-blog-aside-link">
        <span class="myc-hero-diamond" aria-hidden="true">◆</span> {{ t('blog.fediverse', { handle: fediverseUser }) }}
      </NuxtLink>
    </section>
  </aside>
</template>
