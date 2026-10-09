<script setup lang="ts">
import type { Category, PostTransitionNames } from '~/interfaces'
import { categoryColor } from '~/helpers/categories'
import { postTransitionNames } from '~/helpers/postTransition'

const props = withDefaults(defineProps<{
  title: string
  slug?: string
  /** False when the same post is already named elsewhere on the page (a duplicate name skips the whole transition) */
  transition?: boolean
  href: string
  excerpt?: string
  snippet?: string
  highlight?: string
  category?: Category
  date?: string
  dateTime?: string
  author?: string
  readTime?: string
  image?: string
  imageAlt?: string
  read?: boolean
  featured?: boolean
  eyebrow?: string
  moreLabel?: string
  priority?: boolean
  /** Heading of a non-featured card */
  headingLevel?: 'h2' | 'h3'
}>(), {
  slug: undefined,
  transition: true,
  excerpt: undefined,
  snippet: undefined,
  highlight: undefined,
  category: undefined,
  date: undefined,
  dateTime: undefined,
  author: undefined,
  readTime: undefined,
  image: undefined,
  imageAlt: '',
  read: false,
  featured: false,
  eyebrow: undefined,
  moreLabel: undefined,
  priority: false,
  headingLevel: 'h3',
})

const { t } = useI18n()

const eyebrowText = computed<string>(() => props.eyebrow ?? t('myc.card.featured'))
const moreText = computed<string>(() => props.moreLabel ?? t('myc.card.more'))
const byline = computed<string>(() => [props.author, props.readTime].filter(Boolean).join(' · '))
const categoryStyle = computed<Record<string, string> | undefined>(() =>
  props.category ? { '--cat': categoryColor(props.category) } : undefined,
)
const names = computed<PostTransitionNames | undefined>(() =>
  props.transition && props.slug ? postTransitionNames(props.slug) : undefined,
)
const mediaStyle = computed<Record<string, string> | undefined>(() => names.value && { '--myc-vt-media': names.value.media })
const titleStyle = computed<Record<string, string> | undefined>(() => names.value && { '--myc-vt-title': names.value.title })
const imageSize = computed<{ width: number, height: number }>(() =>
  props.featured ? { width: 960, height: 540 } : { width: 640, height: 360 },
)
</script>

<template>
  <article :class="['myc-card', { 'myc-card-featured': featured }]" :style="categoryStyle">
    <div v-if="image" class="myc-card-media myc-post-media" :style="mediaStyle">
      <NuxtImg
        :src="image"
        :alt="imageAlt"
        :width="imageSize.width"
        :height="imageSize.height"
        format="webp"
        :loading="priority ? 'eager' : 'lazy'"
        :fetchpriority="priority ? 'high' : undefined"
        decoding="async"
      />
    </div>
    <div v-else class="myc-card-media myc-card-media-empty" aria-hidden="true" />
    <div class="myc-card-body">
      <span v-if="featured" class="myc-eyebrow myc-card-eyebrow">{{ eyebrowText }}</span>
      <div v-if="category || date || read" class="myc-card-meta">
        <MycCategoryTag v-if="category" :category="category" />
        <span class="myc-card-meta-end">
          <span v-if="read" class="myc-meta myc-read-mark"><span aria-hidden="true">✓</span> {{ t('myc.card.read') }}</span>
          <time v-if="date" class="myc-meta" :datetime="dateTime">{{ date }}</time>
        </span>
      </div>
      <component :is="featured ? 'h2' : headingLevel" class="myc-card-title myc-post-title" :style="titleStyle">
        <NuxtLink :to="href" class="myc-card-link">{{ title }}</NuxtLink>
      </component>
      <p v-if="snippet" class="myc-card-excerpt myc-card-snippet"><MycHighlight :text="snippet" :query="highlight" /></p>
      <p v-else-if="excerpt" class="myc-card-excerpt">{{ excerpt }}</p>
      <div class="myc-card-foot">
        <span class="myc-meta">{{ byline }}</span>
        <span class="myc-card-more" aria-hidden="true">{{ moreText }} <span class="myc-card-arrow">→</span></span>
      </div>
    </div>
  </article>
</template>
