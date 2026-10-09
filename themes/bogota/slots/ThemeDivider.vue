<script setup lang="ts">
import {
  PANORAMA_ATRIO_PATTERN,
  PANORAMA_BUILDING_LINES,
  PANORAMA_CCI_PILASTERS,
  PANORAMA_CITY,
  PANORAMA_CITY_LIGHTS,
  PANORAMA_COLPATRIA_LED_STRIPS,
  PANORAMA_COLPATRIA_MULLIONS,
  PANORAMA_COLPATRIA_WINDOWS,
  PANORAMA_FLOORS,
  PANORAMA_FOOTHILLS,
  PANORAMA_RIDGE,
  PANORAMA_RIDGE_FAR,
  PANORAMA_RIDGE_FILL,
  PANORAMA_SANTAMARIA_CRENELS,
  PANORAMA_TOWER_LIGHTS,
} from './panorama'

defineProps<{
  placement?: 'footer'
}>()

const SWIPE_QUERY = '(max-width: 767px)'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

const { t } = useI18n()
const ledClipId = `bogota-colpatria-led-${useId()}`

const cityRef = ref<SVGSVGElement>()
const isSwipeable = ref(false)
let swipeQuery: MediaQueryList | null = null

function onSwipeChange(event: MediaQueryListEvent): void {
  isSwipeable.value = event.matches
}

onMounted(() => {
  swipeQuery = window.matchMedia(SWIPE_QUERY)
  isSwipeable.value = swipeQuery.matches
  swipeQuery.addEventListener('change', onSwipeChange)
  if (window.matchMedia(REDUCED_MOTION_QUERY).matches) cityRef.value?.pauseAnimations()
})

onBeforeUnmount(() => {
  swipeQuery?.removeEventListener('change', onSwipeChange)
})
</script>

<template>
  <div class="bogota-panorama">
    <div class="myc-meta bogota-panorama-hint">
      <span>{{ t('theme.divider.title') }}</span>
      <span aria-hidden="true">{{ t('theme.divider.swipe') }} →</span>
    </div>
    <div
      class="bogota-land-scroll"
      :role="isSwipeable ? 'region' : undefined"
      :aria-label="isSwipeable ? t('theme.divider.label') : undefined"
      :tabindex="isSwipeable ? 0 : undefined"
    >
      <div class="bogota-land">
        <svg class="bogota-lay bogota-lay1" aria-hidden="true" focusable="false" viewBox="0 0 1440 440" preserveAspectRatio="xMidYMax slice">
          <path :d="PANORAMA_RIDGE_FAR" fill="var(--lay1)" />
        </svg>
        <svg class="bogota-lay bogota-lay2" aria-hidden="true" focusable="false" viewBox="0 0 1440 440" preserveAspectRatio="xMidYMax slice">
          <path :d="PANORAMA_RIDGE_FILL" fill="var(--lay2)" />
          <path :d="PANORAMA_RIDGE" fill="none" stroke="var(--link)" stroke-opacity=".55" stroke-width="1.2" />
          <g class="bogota-monserrate">
            <title>{{ t('theme.divider.monserrateBasilica') }}</title>
            <path d="M490 125 H540 V133 L524 129 L506 127 L490 128 Z" fill="var(--lay2)" stroke="var(--ink-muted)" stroke-width=".8" />
            <g fill="var(--pano-wall)" fill-opacity=".85" stroke="var(--ink-muted)" stroke-width=".8">
              <path d="M494 124 V116 H506 V124 Z M526 124 V117 H538 V124 Z" />
              <path d="M505 124 V108 H527 V124 Z" />
              <path d="M512 124 V92 H520 V124 Z" />
              <path d="M515 86 V83 H517 V86" />
            </g>
            <g fill="var(--brick)" stroke="var(--ink-muted)" stroke-width=".8">
              <path d="M492.5 116 L500 111.5 L507.5 116 Z M524.5 117 L532 112.5 L539.5 117 Z" />
              <path d="M503 108 L516 100.5 L529 108 Z" />
              <path d="M511.5 92 Q516 84.5 520.5 92 Z" />
            </g>
            <path d="M511 104 H521 M511 92 H521" stroke="var(--ink-muted)" stroke-width=".8" fill="none" />
            <path d="M516 83 V75.5 M513.8 78 H518.2" stroke="var(--ink-muted)" stroke-width="1" fill="none" />
            <path d="M514.5 101 V97.5 a1.5 1.5 0 0 1 3 0 V101 Z M514.5 124 V119.5 a1.5 1.5 0 0 1 3 0 V124 Z" fill="var(--pano-opening)" />
            <path
              d="M497 122 V119 M500 122 V119 M503 122 V119 M529 122 V120 M532 122 V120 M535 122 V120 M508 114 V111 M524 114 V111"
              stroke="var(--pano-opening)"
              stroke-width="1.2"
              fill="none"
            />
          </g>
          <g class="bogota-guadalupe">
            <title>{{ t('theme.divider.guadalupeSanctuary') }}</title>
            <path d="M882 95 H920 V99 L914 96.5 L900 93.5 L888 97.5 L882 98 Z" fill="var(--lay2)" stroke="var(--ink-muted)" stroke-width=".8" />
            <g fill="var(--pano-wall)" fill-opacity=".85" stroke="var(--ink-muted)" stroke-width=".8">
              <path d="M886 95 V86 H903 V95 Z" />
              <path d="M886 86 V79 L888.5 76.5 L891 79 V86 Z" />
              <path d="M906 95 V87 H912 V95 Z" />
              <path d="M906.8 87 L908.2 74.5 H909.8 L911.2 87 Z" />
              <path d="M904.6 78.2 L909 75.1 L913.4 78.2 L912.8 79.2 L909 76.8 L905.2 79.2 Z" stroke-width=".6" />
              <circle cx="909" cy="73.1" r="1.4" />
            </g>
            <path d="M884.5 86 L894.5 80.5 L904.5 86 Z" fill="var(--brick)" stroke="var(--ink-muted)" stroke-width=".8" />
            <path d="M888.5 76.5 V72.5 M886.8 74 H890.2" stroke="var(--ink-muted)" stroke-width=".9" fill="none" />
            <path
              d="M887.6 82.5 V80.6 a0.9 0.9 0 0 1 1.8 0 V82.5 Z M893.5 95 V91.5 a1.3 1.3 0 0 1 2.6 0 V95 Z M898 90 V88 H899.6 V90 Z"
              fill="var(--pano-opening)"
            />
          </g>
          <path d="M516 73 L516 66 M900 70 L900 46" stroke="var(--ink-muted)" stroke-width="1" />
          <g class="bogota-land-labels" fill="var(--ink-muted)" text-anchor="middle">
            <text x="515" y="60">{{ t('theme.divider.monserrate') }}</text>
            <text x="900" y="36">{{ t('theme.divider.guadalupe') }}</text>
            <text x="1400" y="36" text-anchor="end">{{ t('theme.divider.view') }}</text>
          </g>
        </svg>
        <svg class="bogota-lay bogota-lay3" aria-hidden="true" focusable="false" viewBox="0 0 1440 440" preserveAspectRatio="xMidYMax slice">
          <path :d="PANORAMA_FOOTHILLS" fill="var(--lay3)" />
        </svg>
        <img
          src="/theme/images/copeton.png"
          alt=""
          class="bogota-copeton bogota-lay bogota-lay-bird"
          width="586"
          height="433"
          loading="lazy"
          decoding="async"
        >
        <svg
          ref="cityRef"
          class="bogota-lay bogota-lay4"
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 1440 440"
          preserveAspectRatio="xMidYMax slice"
        >
          <path :d="PANORAMA_CITY" fill="var(--lay4)" />
          <path class="bogota-lights" :d="PANORAMA_CITY_LIGHTS" fill="var(--category-5)" fill-opacity=".6" />
          <path d="M296 440 V301 L305 290 V440 Z M325 440 V290 L334 301 V440 Z" fill="var(--lay4)" stroke="var(--bld-edge)" stroke-width="1">
            <title>{{ t('theme.divider.atrio') }}</title>
          </path>
          <path
            d="M305 440 V286 H309 V440 Z M321 440 V286 H325 V440 Z"
            fill="var(--pano-shade)"
            fill-opacity=".55"
            stroke="var(--bld-edge)"
            stroke-width="1"
          />
          <path d="M309 440 V279 H321 V440 Z" fill="var(--lay4)" stroke="var(--bld-edge)" stroke-width="1" />
          <path d="M309 440 V279 H321 V440 Z" fill="var(--pano-wall)" fill-opacity=".16" />
          <path class="bogota-atrio" :d="PANORAMA_ATRIO_PATTERN" stroke="var(--accent)" stroke-opacity=".85" stroke-width="1" stroke-linejoin="round" fill="none" />
          <path class="bogota-atrio" d="M305 286 V440 M325 286 V440" stroke="var(--accent)" stroke-opacity=".3" stroke-width=".6" fill="none" />
          <path
            class="bogota-atrio"
            d="M309 279 V268 H321 V279 M309 268 L321 279 M321 268 L309 279 M309 273.5 H321"
            stroke="var(--accent)"
            stroke-opacity=".85"
            stroke-width="1"
            fill="none"
          />
          <path d="M312 268 V259 M312 260 H320 M312 262 L316 260" stroke="var(--ink-muted)" stroke-width=".8" fill="none" />
          <path
            d="M285 440 L290 433 H296 V440 Z M334 440 V433 H340 L345 440 Z"
            fill="var(--link)"
            fill-opacity=".22"
            stroke="var(--bld-edge)"
            stroke-width="1"
          />
          <g fill="var(--lay4)" stroke="var(--bld-edge)" stroke-width="1">
            <path d="M346 440 V286 H350 V280 H374 V286 H378 V440 Z"><title>{{ t('theme.divider.cci') }}</title></path>
            <path d="M386 440 V372 H436 V440 Z" fill="var(--brick)"><title>{{ t('theme.divider.tequendama') }}</title></path>
            <path d="M452 440 V285 L484 267 V440 Z"><title>{{ t('theme.divider.bacataSouth') }}</title></path>
            <path d="M488 440 V306 L514 318 V440 Z"><title>{{ t('theme.divider.bacataNorth') }}</title></path>
            <path d="M530 440 V315 H534 V311 H556 V315 H560 V440 Z"><title>{{ t('theme.divider.avianca') }}</title></path>
            <path d="M588 440 V290 L590 285 H614 L616 290 V440 Z"><title>{{ t('theme.divider.colpatria') }}</title></path>
            <path
              d="M640 440 V366 Q640 356 650 356 H656 V364 H662 V372 H668 V440 Z M672 440 V378 Q672 368 682 368 H687 V376 H692 V384 H697 V440 Z M702 440 V392 Q702 382 712 382 H719 V390 H726 V440 Z"
              fill="var(--brick)"
            ><title>{{ t('theme.divider.parque') }}</title></path>
            <path d="M732 440 V424 Q732 418 740 418 H804 Q812 418 812 424 V440 Z" fill="var(--brick)"><title>{{ t('theme.divider.santamaria') }}</title></path>
            <path :d="PANORAMA_SANTAMARIA_CRENELS" fill="var(--brick)" />
          </g>
          <path class="bogota-floors" :d="PANORAMA_CCI_PILASTERS" stroke="var(--ink-muted)" stroke-opacity=".35" stroke-width="2" fill="none" />
          <path class="bogota-floors" :d="PANORAMA_FLOORS" stroke="var(--bld-edge)" stroke-width="1" fill="none" />
          <path class="bogota-bld-line" :d="PANORAMA_BUILDING_LINES" stroke="var(--bld-edge)" stroke-width="1" fill="none" />
          <path class="bogota-crown" d="M452 285 L484 267" stroke="var(--link)" stroke-width="1.5" />
          <path d="M588 440 V290 L590 285 H594 V440 Z" fill="var(--pano-shade)" fill-opacity=".18" />
          <path d="M594.2 290 V440" stroke="var(--pano-shade)" stroke-opacity=".35" stroke-width="1.2" />
          <path class="bogota-bld-line" :d="PANORAMA_COLPATRIA_MULLIONS" stroke="var(--bld-edge)" stroke-width=".8" fill="none" />
          <path d="M590 285 H614 L615 289 H589 Z" fill="var(--pano-shade)" fill-opacity=".35" />
          <clipPath :id="ledClipId">
            <rect v-for="x in PANORAMA_COLPATRIA_LED_STRIPS" :key="x" :x="x" y="292" width="1.1" height="116" />
          </clipPath>
          <g class="bogota-colpatria" :clip-path="`url(#${ledClipId})`">
            <g>
              <animate attributeName="opacity" values="1;0" keyTimes="0;0.3333" dur="18s" calcMode="discrete" repeatCount="indefinite" />
              <title>{{ t('theme.divider.flagPalestine') }}</title>
              <rect x="588" y="292" width="9.33333" height="116" fill="#000000" />
              <rect x="597.333" y="292" width="9.33333" height="116" fill="#FFFFFF" />
              <rect x="606.667" y="292" width="9.33333" height="116" fill="#007A3D" />
              <path d="M588 292 L616 292 L602 312 Z" fill="#CE1126" />
            </g>
            <g opacity="0">
              <animate attributeName="opacity" values="0;1;0" keyTimes="0;0.3333;0.6667" dur="18s" calcMode="discrete" repeatCount="indefinite" />
              <title>{{ t('theme.divider.flagColombia') }}</title>
              <rect x="588" y="292" width="28" height="58" fill="#FCD116" />
              <rect x="588" y="350" width="28" height="29" fill="#003893" />
              <rect x="588" y="379" width="28" height="29" fill="#CE1126" />
            </g>
            <g opacity="0">
              <animate attributeName="opacity" values="0;1;0" keyTimes="0;0.6667;1" dur="18s" calcMode="discrete" repeatCount="indefinite" />
              <title>{{ t('theme.divider.flagBogota') }}</title>
              <rect x="588" y="292" width="28" height="58" fill="#FCD116" />
              <rect x="588" y="350" width="28" height="58" fill="#CE1126" />
            </g>
          </g>
          <path class="bogota-lights bogota-colpatria-base" :d="PANORAMA_COLPATRIA_WINDOWS" fill="var(--category-5)" fill-opacity=".8" />
          <g class="bogota-lights" fill="#FFFFFF" fill-opacity=".85">
            <rect x="600" y="286.3" width="6" height="1.4" />
            <circle cx="590.6" cy="286.2" r=".7" />
            <circle cx="613.4" cy="286.2" r=".7" />
          </g>
          <path class="bogota-lights" :d="PANORAMA_TOWER_LIGHTS" fill="var(--category-5)" fill-opacity=".75" />
          <g class="bogota-lights" fill="var(--accent)">
            <circle class="bogota-beacon" cx="484" cy="269" r="1.8" />
            <circle class="bogota-beacon bogota-beacon-2" cx="602" cy="283" r="1.8" />
            <circle class="bogota-beacon bogota-beacon-3" cx="312" cy="258" r="1.8" />
          </g>
        </svg>
      </div>
    </div>
  </div>
</template>
