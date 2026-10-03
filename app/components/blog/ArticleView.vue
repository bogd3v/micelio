<script setup lang="ts">
import type { Category, NumberedReference, StrapiPost, TocHeading } from '~/interfaces'
import { numberReferences } from '~/helpers/citations'
import { isCategory } from '~/helpers/categories'
import { formatDotDate } from '~/helpers/formatDate'
import { mastodonShareUrl } from '~/helpers/share'
import { extractHeadings } from '~/helpers/toc'

const props = withDefaults(defineProps<{
  post: StrapiPost
  shareUrl?: string
  draft?: boolean
}>(), {
  shareUrl: '',
  draft: false,
})

const { locale, t } = useI18n()
const { getMediaUrl } = useStrapi()
const { localizePath } = useLocaleUtils()
const config = useRuntimeConfig()

const prose = ref<HTMLElement | null>(null)

const coverUrl = computed<string>(() => props.post.cover ? getMediaUrl(props.post.cover) : '')
const category = computed<Category | undefined>(() => {
  const slug = props.post.category?.slug
  return isCategory(slug) ? slug : undefined
})
const references = computed<NumberedReference[]>(() => numberReferences(props.post.blocks, props.post.references))
const headings = computed<TocHeading[]>(() => {
  const blockHeadings = extractHeadings(props.post.blocks)
  if (!references.value.length) return blockHeadings
  return [...blockHeadings, { id: 'references', text: t('post.references.title'), level: 2 }]
})
const mastodonUrl = computed<string>(() => mastodonShareUrl(props.post.title, props.shareUrl))
const publishedDate = computed<string>(() => formatDotDate(props.post.publishedAt))
const federated = computed<boolean>(() => !props.draft && locale.value === config.public.fediverseLocale && Boolean(props.post.documentId))
const readDocumentId = computed<string | undefined>(() => props.draft ? undefined : props.post.documentId)

useMarkAsRead(prose, readDocumentId)
</script>

<template>
  <div class="bd-article-page">
    <header class="bd-article-head">
      <div class="bd-article-kicker">
        <BdCategoryTag v-if="category" :category="category" />
        <time v-if="publishedDate" class="bd-meta" :datetime="post.publishedAt ?? undefined">{{ publishedDate }}</time>
        <span v-if="post.readTime" class="bd-meta">{{ t("blog.readTime", { minutes: post.readTime }) }}</span>
      </div>
      <h1 class="bd-article-title bd-wide">{{ post.title }}</h1>
      <p v-if="post.description" class="bd-article-lead">{{ post.description }}</p>
      <div class="bd-article-byline">
        <div class="bd-article-author">
          <BlogAuthorBadge :author="post.author" />
          <div class="bd-article-author-text">
            <span class="bd-article-author-name">{{ post.author?.name || t("post.anonymous") }}</span>
            <span class="bd-meta bd-home-eyebrow bd-article-place">{{ t("bd.header.hud.city") }} · {{ t("bd.header.hud.coords") }}</span>
          </div>
        </div>
        <div v-if="!draft" class="bd-article-actions">
          <BlogCopyLinkButton :url="shareUrl" />
          <BdButton :href="mastodonUrl" variant="text" size="sm" target="_blank" rel="noopener noreferrer" :aria-label="t('post.shareOn', { network: 'Mastodon' })">
            Mastodon <span aria-hidden="true">↗</span>
          </BdButton>
        </div>
      </div>
      <BlogFediverseBar v-if="federated" :slug="post.slug" :document-id="post.documentId" />
    </header>

    <figure v-if="coverUrl" class="bd-article-figure">
      <div class="bd-article-cover">
        <NuxtImg
          :src="coverUrl"
          :alt="post.cover?.alternativeText || post.title"
          width="1200"
          height="675"
          format="webp"
          loading="eager"
          fetchpriority="high"
          decoding="async"
        />
      </div>
      <figcaption v-if="post.coverCredit" class="bd-article-cover-credit">
        <BdFigureCredit :credit="post.coverCredit" />
      </figcaption>
    </figure>
    <div v-else class="bd-article-cover bd-article-cover-empty" aria-hidden="true" />

    <div class="bd-article-body">
      <BlogTableOfContents class="bd-article-toc" :headings="headings" />

      <article class="bd-article-content">
        <div ref="prose" class="bd-prose">
          <StrapiBlocksRenderer :blocks="post.blocks" />
        </div>

        <BlogReferences :entries="references" />

        <div class="bd-article-after">
          <div v-if="post.tags?.length" class="bd-article-tags">
            <span class="bd-eyebrow bd-home-eyebrow">{{ t("post.tags") }}</span>
            <NuxtLink
              v-for="tag in post.tags"
              :key="tag.slug"
              :to="{ path: localizePath('/blog'), query: { tag: tag.slug } }"
              class="bd-chip bd-blog-tag"
            >
              #{{ tag.name }}
            </NuxtLink>
          </div>
          <BlogReadingPath v-if="!draft && category && post.documentId" :category="category" :current-document-id="post.documentId" />
          <BlogAuthorCard :author="post.author" />
          <BlogBuyMeACoffee />
        </div>
      </article>

      <BlogShareButtons v-if="!draft" class="bd-article-share" :title="post.title" :url="shareUrl" />
    </div>

    <template v-if="!draft">
      <BlogCommentSection :slug="post.slug" :document-id="post.documentId" :federated="federated" />
      <BlogRelatedPosts :current-post-id="post.id" :category="post.category" />
    </template>
  </div>
</template>
