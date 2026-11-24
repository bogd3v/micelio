<script setup lang="ts">
import type { PageMedia } from '~/interfaces'

/**
 * One quotation: the text in a `<blockquote>` (whose `cite` is the source, when there is one), and under it who said it:
 * the author and the role as text, the picture, the logo of their company and the rating as text ("4 of 5").
 * Shared by the testimonials and, from the quote block of line 36 of the block catalogue plan, by `QuoteBlock`.
 */
defineProps<{
  quote: string
  author: string
  role?: string
  avatar?: PageMedia
  /** An `http(s)` URL, the `cite` attribute. */
  sourceUrl?: string
  logo?: PageMedia
  /** A whole number from 1 to 5. */
  rating?: number
}>()

const { t } = useI18n()
</script>

<template>
  <figure>
    <blockquote class="myc-section-quote" :cite="sourceUrl">
      <p>{{ quote }}</p>
    </blockquote>
    <figcaption class="myc-section-author">
      <SectionMedia v-if="avatar" :media="avatar" sizes="48px" decorative />
      <span>
        <strong>{{ author }}</strong>
        <span v-if="role"> · {{ role }}</span>
        <span v-if="rating" class="myc-section-quote-rating"> · {{ t('sections.rating', { rating, max: 5 }) }}</span>
      </span>
      <SectionMedia v-if="logo" :media="logo" root-class="myc-section-media myc-section-quote-logo" sizes="96px" />
    </figcaption>
  </figure>
</template>
