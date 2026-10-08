<script setup lang="ts">
import { blogPath } from '~/helpers/blog'
import type { StrapiPost } from '~/interfaces'
import type { PostTransitionNames } from '~/helpers/postTransition'
import { postTransitionNames } from '~/helpers/postTransition'

defineOptions({ name: 'RegionArticleAside' })

const props = withDefaults(defineProps<{
  post: StrapiPost
  shareUrl?: string
  draft?: boolean
}>(), {
  shareUrl: '',
  draft: false,
})

const { t } = useI18n()
const { isStatic } = useStaticSite()
const hud = useThemeHud()
const { localizePath } = useLocaleUtils()
const commentsOn = useModule('comments')
const supportOn = useModule('support')
const { coverUrl, category, references, headings, mastodonUrl, publishedDate, federated, readDocumentId } = useArticleState(props)

const names = computed<PostTransitionNames>(() => postTransitionNames(props.post.slug))

const prose = ref<HTMLElement | null>(null)

useMarkAsRead(prose, readDocumentId)
</script>

<template>
  <div class="bd-article-page" data-layout="aside">
    <header class="bd-article-head">
      <div class="bd-article-kicker">
        <BdCategoryTag v-if="category" :category="category" />
        <time v-if="publishedDate" class="bd-meta" :datetime="post.publishedAt ?? undefined">{{ publishedDate }}</time>
        <span v-if="post.readTime" class="bd-meta">{{ t("blog.readTime", { minutes: post.readTime }) }}</span>
      </div>
      <h1 class="bd-article-title bd-post-title bd-wide" :style="{ '--bd-vt-title': names.title }" :data-pagefind-meta="isStatic ? 'title' : undefined">{{ post.title }}</h1>
      <p v-if="post.description" class="bd-article-lead" :data-pagefind-body="isStatic ? '' : undefined">{{ post.description }}</p>
      <div class="bd-article-byline">
        <div class="bd-article-author">
          <BlogAuthorBadge :author="post.author" />
          <div class="bd-article-author-text">
            <span class="bd-article-author-name">{{ post.author?.name || t("post.anonymous") }}</span>
            <span v-if="hud.city" class="bd-meta bd-home-eyebrow bd-article-place">{{ [hud.city, hud.coords].filter(Boolean).join(" · ") }}</span>
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
      <div class="bd-article-cover bd-post-media" :style="{ '--bd-vt-media': names.media }">
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

      <article class="bd-article-content" :data-pagefind-body="isStatic ? '' : undefined" :data-pagefind-meta="isStatic ? 'kind:article' : undefined">
        <div ref="prose" class="bd-prose">
          <StrapiBlocksRenderer :blocks="post.blocks" />
        </div>

        <BlogReferences :entries="references" />

        <div class="bd-article-after" :data-pagefind-ignore="isStatic ? '' : undefined">
          <div v-if="post.tags?.length" class="bd-article-tags">
            <span class="bd-eyebrow bd-home-eyebrow">{{ t("post.tags") }}</span>
            <NuxtLink
              v-for="tag in post.tags"
              :key="tag.slug"
              :to="blogPath({ tag: tag.slug, page: 1 }, localizePath('/blog'))"
              class="bd-chip bd-blog-tag"
            >
              #{{ tag.name }}
            </NuxtLink>
          </div>
          <BlogReadingPath v-if="!draft && category && post.documentId" :category="category" :current-document-id="post.documentId" />
          <BlogAuthorCard :author="post.author" />
          <BlogBuyMeACoffee v-if="supportOn" />
        </div>
      </article>

      <BlogShareButtons v-if="!draft" class="bd-article-share" :title="post.title" :url="shareUrl" />
    </div>

    <template v-if="!draft">
      <BlogCommentSection v-if="commentsOn" :slug="post.slug" :document-id="post.documentId" :federated="federated" />
      <BlogRelatedPosts :current-post-id="post.id" :category="post.category" />
    </template>
  </div>
</template>
