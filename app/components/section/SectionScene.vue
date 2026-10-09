<script setup lang="ts">
import type { PageMedia, SceneSection } from '~/interfaces'

import { TRUSTED_MEDIA_PREFIX, isTrustedMedia } from '~/helpers/trustedMedia'

const props = defineProps<{
  section: SceneSection
  /** The poster paints first: eager and high priority (the section opens the page) */
  eager?: boolean
}>()

const { getMediaUrl } = useStrapi()
const trustedPrefix = inject(TRUSTED_MEDIA_PREFIX, undefined)
// Three.js and the model load once the scene is visible, after load; the poster is what the server renders (ADR 0006, section 6)
useHeavyIsland('scene')
const titleId = useId()

// The static fallback: the poster, described by the scene's alt text
const poster = computed<PageMedia>(() => ({ ...props.section.poster, alternativeText: props.section.alt }))

// The model's URL: static builds copy it into /_media/ and rewrite it, and the dynamic CSP names its origin (ADR 0004)
const modelUrl = computed<string>(() => isTrustedMedia(props.section.model.url, trustedPrefix) ? props.section.model.url : getMediaUrl(props.section.model.url))
</script>

<template>
  <section class="myc-section" data-section="scene" :data-variant="section.variant" :aria-labelledby="section.title ? titleId : undefined">
    <div class="myc-section-inner">
      <micelio-scene :data-model="modelUrl">
        <SectionMedia :media="poster" sizes="100vw xl:1100px" :eager="eager" />
      </micelio-scene>
      <SectionHead :title="section.title" :text="section.text" :title-id="titleId" />
    </div>
  </section>
</template>
