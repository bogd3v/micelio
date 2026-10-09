<script setup lang="ts">
import type { StrapiSlide, StrapiSlider } from '~/interfaces'
import { formatFigureNumber, slidesOf } from '~/helpers/figures'

const props = defineProps<{
  block: StrapiSlider
  figureNumber?: number
}>()

const { getMediaUrl } = useStrapi()
const { t } = useI18n()
const { isStatic } = useStaticSite()

const slides = computed<StrapiSlide[]>(() => slidesOf(props.block))
const totalSlides = computed(() => slides.value.length)
// Without JS only the first slide shows, so there is nothing to control
const hasMultiple = computed(() => totalSlides.value > 1 && !isStatic)

const currentIndex = ref(0)
const isPaused = ref(false)
const progress = ref(0)
const isTransitioning = ref(false)

const activeSlide = computed<StrapiSlide | undefined>(() => slides.value[currentIndex.value])
const activeCaption = computed<string>(() => activeSlide.value?.caption?.trim() ?? '')
const hasFigcaption = computed<boolean>(() => slides.value.some(slide => Boolean(slide.caption?.trim() || slide.credit)))

const prefersReducedMotion = ref(false)

onMounted(() => {
  prefersReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
})

function goTo(index: number) {
  if (isTransitioning.value || index === currentIndex.value) return
  isTransitioning.value = true
  currentIndex.value = index
  progress.value = 0
  setTimeout(() => {
    isTransitioning.value = false
  }, 600)
}

function prev() {
  goTo(currentIndex.value > 0 ? currentIndex.value - 1 : totalSlides.value - 1)
}

function next() {
  goTo(currentIndex.value < totalSlides.value - 1 ? currentIndex.value + 1 : 0)
}

const touchStartX = ref(0)
const touchDeltaX = ref(0)
const isDragging = ref(false)

function onTouchStart(event: TouchEvent) {
  touchStartX.value = event.changedTouches[0]!.screenX
  isDragging.value = true
  touchDeltaX.value = 0
}

function onTouchMove(event: TouchEvent) {
  if (!isDragging.value) return
  touchDeltaX.value = event.changedTouches[0]!.screenX - touchStartX.value
}

function onTouchEnd() {
  isDragging.value = false
  const threshold = 50
  if (Math.abs(touchDeltaX.value) > threshold) {
    if (touchDeltaX.value < 0) next()
    else prev()
  }
  touchDeltaX.value = 0
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    prev()
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    next()
  }
}

const AUTOPLAY_DURATION = 6000
let animationFrameId: number | null = null
let lastTimestamp: number | null = null

function startAutoplay() {
  if (!hasMultiple.value || prefersReducedMotion.value) return

  const animate = (timestamp: number) => {
    if (lastTimestamp === null) lastTimestamp = timestamp
    const elapsed = timestamp - lastTimestamp

    if (!isPaused.value) {
      progress.value += (elapsed / AUTOPLAY_DURATION) * 100
      if (progress.value >= 100) {
        progress.value = 0
        next()
      }
    }

    lastTimestamp = timestamp
    animationFrameId = requestAnimationFrame(animate)
  }

  animationFrameId = requestAnimationFrame(animate)
}

function stopAutoplay() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
    lastTimestamp = null
  }
}

watch(hasMultiple, (value) => {
  if (value) {
    startAutoplay()
  } else {
    stopAutoplay()
  }
})

onMounted(() => {
  if (hasMultiple.value) startAutoplay()
})

onUnmounted(stopAutoplay)
</script>

<template>
  <figure
    class="myc-fig myc-slider"
    tabindex="0"
    role="region"
    aria-roledescription="carousel"
    :aria-label="t('common.ariaGallery', 'Image gallery')"
    @keydown="onKeydown"
  >
    <div
      class="myc-fig-media myc-slider-media"
      @mouseenter="isPaused = true"
      @mouseleave="isPaused = false"
      @touchstart.passive="onTouchStart"
      @touchmove.passive="onTouchMove"
      @touchend.passive="onTouchEnd"
    >
      <div class="myc-slider-frame">
        <div
          v-for="(slide, index) in slides"
          :key="index"
          class="myc-slider-slide"
          :class="{ 'myc-slider-slide-active': index === currentIndex }"
          role="group"
          :aria-roledescription="hasMultiple ? 'slide' : undefined"
          :aria-label="`${index + 1} ${t('common.of', 'of')} ${totalSlides}`"
          :aria-hidden="index !== currentIndex"
        >
          <NuxtImg
            :src="getMediaUrl(slide.file.url)"
            :alt="slide.file.alternativeText || t('common.ariaGalleryImage', 'Gallery image')"
            width="1200"
            format="webp"
            loading="lazy"
            draggable="false"
            class="myc-slider-img"
            :class="{ 'myc-slider-img-zoom': index === currentIndex && !prefersReducedMotion }"
          />
        </div>
      </div>

      <div
        v-if="hasMultiple"
        class="myc-slider-scrim"
      />

      <template v-if="hasMultiple">
        <button
          :aria-label="t('common.ariaPrevSlide', 'Previous slide')"
          class="myc-slider-arrow myc-slider-prev"
          @click="prev"
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          :aria-label="t('common.ariaNextSlide', 'Next slide')"
          class="myc-slider-arrow myc-slider-next"
          @click="next"
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </template>

      <div
        v-if="hasMultiple"
        class="myc-slider-dots"
      >
        <div class="myc-slider-dot-list">
          <button
            v-for="(_, index) in slides"
            :key="index"
            :aria-label="`${t('common.goToSlide', 'Go to slide')} ${index + 1}`"
            class="myc-slider-dot"
            :class="{ 'myc-slider-dot-active': index === currentIndex }"
            @click="goTo(index)"
          >
            <span class="myc-slider-dot-track" />
            <span
              v-if="index === currentIndex"
              class="myc-slider-dot-fill"
              :style="{ width: `${progress}%` }"
            />
            <span
              v-else
              class="myc-slider-dot-hover"
            />
          </button>
        </div>
      </div>

      <div
        v-if="hasMultiple"
        class="myc-slider-count"
      >
        <span class="myc-slider-count-text">
          {{ String(currentIndex + 1).padStart(2, '0') }} / {{ String(totalSlides).padStart(2, '0') }}
        </span>
      </div>
    </div>

    <figcaption v-if="hasFigcaption" aria-live="polite">
      <span v-if="activeCaption || figureNumber" class="myc-fig-cap">
        <span v-if="figureNumber" class="myc-fig-n">{{ t('bd.figure.number', { n: formatFigureNumber(figureNumber) }) }}</span>
        {{ activeCaption }}
      </span>
      <BdFigureCredit v-if="activeSlide?.credit" :key="currentIndex" :credit="activeSlide.credit" />
    </figcaption>
  </figure>
</template>
