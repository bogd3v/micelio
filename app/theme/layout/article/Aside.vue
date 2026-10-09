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
  <div class="myc-article-page" data-layout="aside">
    <header class="myc-article-head">
      <div class="myc-article-kicker">
        <BdCategoryTag v-if="category" :category="category" />
        <time v-if="publishedDate" class="myc-meta" :datetime="post.publishedAt ?? undefined">{{ publishedDate }}</time>
        <span v-if="post.readTime" class="myc-meta">{{ t("blog.readTime", { minutes: post.readTime }) }}</span>
      </div>
      <h1 class="myc-article-title myc-post-title myc-wide" :style="{ '--myc-vt-title': names.title }" :data-pagefind-meta="isStatic ? 'title' : undefined">{{ post.title }}</h1>
      <p v-if="post.description" class="myc-article-lead" :data-pagefind-body="isStatic ? '' : undefined">{{ post.description }}</p>
      <div class="myc-article-byline">
        <div class="myc-article-author">
          <BlogAuthorBadge :author="post.author" />
          <div class="myc-article-author-text">
            <span class="myc-article-author-name">{{ post.author?.name || t("post.anonymous") }}</span>
            <span v-if="hud.city" class="myc-meta myc-home-eyebrow myc-article-place">{{ [hud.city, hud.coords].filter(Boolean).join(" · ") }}</span>
          </div>
        </div>
        <div v-if="!draft" class="myc-article-actions">
          <BlogCopyLinkButton :url="shareUrl" />
          <BdButton :href="mastodonUrl" variant="text" size="sm" target="_blank" rel="noopener noreferrer" :aria-label="t('post.shareOn', { network: 'Mastodon' })">
            Mastodon <span aria-hidden="true">↗</span>
          </BdButton>
        </div>
      </div>
      <BlogFediverseBar v-if="federated" :slug="post.slug" :document-id="post.documentId" />
    </header>

    <figure v-if="coverUrl" class="myc-article-figure">
      <div class="myc-article-cover myc-post-media" :style="{ '--myc-vt-media': names.media }">
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
      <figcaption v-if="post.coverCredit" class="myc-article-cover-credit">
        <BdFigureCredit :credit="post.coverCredit" />
      </figcaption>
    </figure>
    <div v-else class="myc-article-cover myc-article-cover-empty" aria-hidden="true" />

    <div class="myc-article-body">
      <BlogTableOfContents class="myc-article-toc" :headings="headings" />

      <article class="myc-article-content" :data-pagefind-body="isStatic ? '' : undefined" :data-pagefind-meta="isStatic ? 'kind:article' : undefined">
        <div ref="prose" class="myc-prose">
          <StrapiBlocksRenderer :blocks="post.blocks" />
        </div>

        <BlogReferences :entries="references" />

        <div class="myc-article-after" :data-pagefind-ignore="isStatic ? '' : undefined">
          <div v-if="post.tags?.length" class="myc-article-tags">
            <span class="myc-eyebrow myc-home-eyebrow">{{ t("post.tags") }}</span>
            <NuxtLink
              v-for="tag in post.tags"
              :key="tag.slug"
              :to="blogPath({ tag: tag.slug, page: 1 }, localizePath('/blog'))"
              class="myc-chip myc-blog-tag"
            >
              #{{ tag.name }}
            </NuxtLink>
          </div>
          <BlogReadingPath v-if="!draft && category && post.documentId" :category="category" :current-document-id="post.documentId" />
          <BlogAuthorCard :author="post.author" />
          <BlogBuyMeACoffee v-if="supportOn" />
        </div>
      </article>

      <BlogShareButtons v-if="!draft" class="myc-article-share" :title="post.title" :url="shareUrl" />
    </div>

    <template v-if="!draft">
      <BlogCommentSection v-if="commentsOn" :slug="post.slug" :document-id="post.documentId" :federated="federated" />
      <BlogRelatedPosts :current-post-id="post.id" :category="post.category" />
    </template>
  </div>
</template>
