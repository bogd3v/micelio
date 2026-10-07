<script setup lang="ts">
import type { Category } from '~/interfaces'
import { categoryColor } from '~/helpers/categories'

const props = withDefaults(defineProps<{
  title: string
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

const eyebrowText = computed<string>(() => props.eyebrow ?? t('bd.card.featured'))
const moreText = computed<string>(() => props.moreLabel ?? t('bd.card.more'))
const byline = computed<string>(() => [props.author, props.readTime].filter(Boolean).join(' · '))
const categoryStyle = computed<Record<string, string> | undefined>(() =>
  props.category ? { '--cat': categoryColor(props.category) } : undefined,
)
const imageSize = computed<{ width: number, height: number }>(() =>
  props.featured ? { width: 960, height: 540 } : { width: 640, height: 360 },
)
</script>

<template>
  <article :class="['bd-card', { 'bd-card-featured': featured }]" :style="categoryStyle">
    <div v-if="image" class="bd-card-media">
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
    <div v-else class="bd-card-media bd-card-media-empty" aria-hidden="true" />
    <div class="bd-card-body">
      <span v-if="featured" class="bd-eyebrow bd-card-eyebrow">{{ eyebrowText }}</span>
      <div v-if="category || date || read" class="bd-card-meta">
        <BdCategoryTag v-if="category" :category="category" />
        <span class="bd-card-meta-end">
          <span v-if="read" class="bd-meta bd-read-mark"><span aria-hidden="true">✓</span> {{ t('bd.card.read') }}</span>
          <time v-if="date" class="bd-meta" :datetime="dateTime">{{ date }}</time>
        </span>
      </div>
      <component :is="featured ? 'h2' : headingLevel" class="bd-card-title">
        <NuxtLink :to="href" class="bd-card-link">{{ title }}</NuxtLink>
      </component>
      <p v-if="snippet" class="bd-card-excerpt bd-card-snippet"><BdHighlight :text="snippet" :query="highlight" /></p>
      <p v-else-if="excerpt" class="bd-card-excerpt">{{ excerpt }}</p>
      <div class="bd-card-foot">
        <span class="bd-meta">{{ byline }}</span>
        <span class="bd-card-more" aria-hidden="true">{{ moreText }} <span class="bd-card-arrow">→</span></span>
      </div>
    </div>
  </article>
</template>
