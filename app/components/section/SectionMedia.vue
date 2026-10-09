<script setup lang="ts">
import type { PageMedia } from '~/interfaces'
import { isTrustedMedia } from '~/helpers/trustedMedia'
import { TRUSTED_MEDIA_PREFIX } from '~/constants/media'

const props = withDefaults(defineProps<{
  media?: PageMedia | null
  sizes?: string
  /** The image that paints first: eager and high priority */
  eager?: boolean
  /** Poster of a video */
  poster?: PageMedia | null
  /** Decorative (an icon next to a title): empty alt */
  decorative?: boolean
  /** Alt text when the media has none */
  fallbackAlt?: string
  rootClass?: string
}>(), {
  media: undefined,
  sizes: '100vw',
  eager: false,
  poster: undefined,
  decorative: false,
  fallbackAlt: '',
  rootClass: 'myc-section-media',
})

const { t } = useI18n()
const { getMediaUrl } = useStrapi()
const trustedPrefix = inject(TRUSTED_MEDIA_PREFIX, undefined)

// Strapi uploads on the site, or an absolute http(s) URL (the CSP limits the origins); the server applies the same rule
function isUsable(url: string | undefined): boolean {
  if (!url) return false
  if (isTrustedMedia(url, trustedPrefix)) return true
  return (url.startsWith('/uploads/') && !url.includes('..')) || /^https?:\/\//i.test(url)
}

const kind = computed<'video' | 'svg' | 'image'>(() => {
  const mime = props.media?.mime ?? ''
  if (mime.startsWith('video/')) return 'video'
  if (mime === 'image/svg+xml' || props.media?.url.toLowerCase().split('?')[0]?.endsWith('.svg')) return 'svg'
  return 'image'
})
// A trusted path is the site's own: no Strapi origin in front
function resolve(url: string | undefined): string {
  return isTrustedMedia(url, trustedPrefix) ? url! : getMediaUrl(url)
}

const src = computed<string>(() => resolve(props.media?.url))
const posterSrc = computed<string | undefined>(() => props.poster && isUsable(props.poster.url) ? resolve(props.poster.url) : undefined)
const alt = computed<string>(() => props.decorative ? '' : (props.media?.alternativeText || props.fallbackAlt))
const width = computed<number | undefined>(() => props.media?.width || undefined)
const height = computed<number | undefined>(() => props.media?.height || undefined)
const ratio = computed<string | undefined>(() => width.value && height.value ? `${width.value} / ${height.value}` : undefined)
</script>

<template>
  <div v-if="media && isUsable(media.url)" :class="rootClass" :style="ratio ? { aspectRatio: ratio } : undefined">
    <video
      v-if="kind === 'video'"
      controls
      muted
      playsinline
      preload="metadata"
      :poster="posterSrc"
      :width="width"
      :height="height"
      :aria-label="alt || undefined"
    >
      <source :src="src" :type="media.mime">
      {{ t('sections.video') }}
    </video>
    <img
      v-else-if="kind === 'svg'"
      :src="src"
      :alt="alt"
      :width="width"
      :height="height"
      :loading="eager ? 'eager' : 'lazy'"
      :fetchpriority="eager ? 'high' : undefined"
      decoding="async"
    >
    <NuxtPicture
      v-else
      :src="src"
      :alt="alt"
      :width="width"
      :height="height"
      :sizes="sizes"
      format="avif,webp"
      :loading="eager ? 'eager' : 'lazy'"
      :img-attrs="{ fetchpriority: eager ? 'high' : undefined, decoding: 'async' }"
    />
  </div>
</template>
