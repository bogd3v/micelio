<script setup lang="ts">
interface FlightRoute {
  d: string
  opacity: number
}

interface Flyer {
  id: string
  route: string
  timing: number
  wing: number
}

interface HeroPhoto {
  theme: 'night' | 'day'
  src: string
}

const props = withDefaults(defineProps<{
  compact?: boolean
}>(), {
  compact: false,
})

const { t, locale } = useI18n()

const PHOTO_SOURCE_URL = 'https://commons.wikimedia.org/wiki/File:Paisaje_Sumapaz,_Colombia.jpg'

const PHOTOS: readonly HeroPhoto[] = [
  { theme: 'night', src: '/theme/images/hero/sumapaz-night.jpg' },
  { theme: 'day', src: '/theme/images/hero/sumapaz-day.jpg' },
]

const ROUTES: readonly FlightRoute[] = [
  { d: 'M -40 560 C 140 420, 300 520, 440 360 S 640 180, 820 120', opacity: 0.55 },
  { d: 'M -40 260 C 120 200, 260 320, 400 250 S 620 90, 820 170', opacity: 0.35 },
  { d: 'M 120 780 C 220 600, 380 640, 500 500 S 700 400, 820 420', opacity: 0.35 },
]

const COMPACT_ROUTES: readonly FlightRoute[] = [
  { d: 'M -30 220 C 60 160, 140 200, 200 140 S 300 60, 400 70', opacity: 0.55 },
  { d: 'M -30 90 C 60 70, 130 130, 200 100 S 320 30, 400 60', opacity: 0.35 },
  { d: 'M 40 320 C 100 250, 180 260, 240 200 S 340 170, 400 180', opacity: 0.35 },
]

const licenseUrl = computed<string>(() => `https://creativecommons.org/licenses/by-sa/4.0/deed.${locale.value}`)
const width = computed<number>(() => (props.compact ? 390 : 760))
const height = computed<number>(() => (props.compact ? 300 : 720))
const routes = computed<readonly FlightRoute[]>(() => (props.compact ? COMPACT_ROUTES : ROUTES))
const flyers = computed<Flyer[]>(() =>
  routes.value.flatMap((route, routeIndex) =>
    [0, 1, 2].map(wing => ({
      id: `${routeIndex}-${wing}`,
      route: `path("${route.d}")`,
      timing: routeIndex === 1 ? wing + 3 : wing,
      wing,
    })),
  ),
)
</script>

<template>
  <div :class="['bogota-flight', { 'bogota-flight-compact': compact }]">
    <NuxtImg
      v-for="photo in PHOTOS"
      :key="photo.theme"
      :src="photo.src"
      :class="['bogota-hero-photo', `bogota-hero-photo-${photo.theme}`]"
      :sizes="`${width}px`"
      :densities="compact ? 'x1' : 'x1 x2'"
      format="webp"
      loading="lazy"
      fetchpriority="high"
      alt=""
      aria-hidden="true"
    />
    <svg :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" class="bogota-flight-map" aria-hidden="true" focusable="false">
      <g v-if="!compact" class="bogota-flight-place" fill="var(--ink-muted)">
        <path d="M558 108 H574 M566 100 V116" stroke="var(--ink-muted)" stroke-width="1" />
        <rect x="547" y="105" width="6" height="6" fill="var(--link)" />
        <text x="539" y="112" text-anchor="end">{{ t('theme.hero.place') }}</text>
      </g>
      <path
        v-for="(route, index) in routes"
        :key="`route-${index}`"
        class="bd-flight-route"
        :d="route.d"
        fill="none"
        stroke="var(--link)"
        :stroke-opacity="route.opacity"
        stroke-width="1.2"
      />
    </svg>
    <div
      v-for="flyer in flyers"
      :key="flyer.id"
      :class="['bogota-flyer', `bogota-flyer-t${flyer.timing}`, `bogota-flyer-w${flyer.wing}`]"
      :style="{ offsetPath: flyer.route }"
      aria-hidden="true"
    >
      <svg width="22" height="14" viewBox="0 0 22 14" focusable="false">
        <path d="M1 9 Q6 1 11 8 Q16 1 21 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    <i18n-t keypath="theme.hero.figure.caption" tag="p" class="bd-meta bogota-flight-caption" scope="global">
      <template #author>
        <a
          :href="PHOTO_SOURCE_URL"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="t('theme.hero.figure.authorAria')"
        >{{ t('theme.hero.figure.author') }}</a>
      </template>
      <template #license>
        <a
          :href="licenseUrl"
          target="_blank"
          rel="license noopener noreferrer"
          :aria-label="t('theme.hero.figure.licenseAria')"
        >{{ t('theme.hero.figure.license') }}</a>
      </template>
    </i18n-t>
  </div>
</template>
