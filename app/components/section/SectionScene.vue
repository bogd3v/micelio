<script setup lang="ts">
import { optionAttributes } from '~/helpers/blockOptions'
import type { PageMedia, SceneSection } from '~/interfaces'

import { isTrustedMedia } from '~/helpers/trustedMedia'
import { TRUSTED_MEDIA_PREFIX } from '~/constants/media'

const props = defineProps<{
  section: SceneSection
  /** The poster paints first: eager and high priority (the section opens the page) */
  eager?: boolean
  /** The admin's preview asked for the static alternative: the poster, with no element for the island to take over (ADR 0019, amendment of 2026-11-04) */
  renderStatic?: boolean
}>()

const { getMediaUrl } = useStrapi()
const trustedPrefix = inject(TRUSTED_MEDIA_PREFIX, undefined)
// Three.js and the model load once the scene is visible, after load; the poster is what the server renders (ADR 0006, section 6)
if (!props.renderStatic) useHeavyIsland('scene')
const titleId = useId()

// The static fallback: the poster, described by the scene's alt text
const poster = computed<PageMedia>(() => ({ ...props.section.poster, alternativeText: props.section.alt }))

// The model's URL: static builds copy it into /_media/ and rewrite it, and the dynamic CSP names its origin (ADR 0004)
const modelUrl = computed<string>(() => isTrustedMedia(props.section.model.url, trustedPrefix) ? props.section.model.url : getMediaUrl(props.section.model.url))
</script>

<template>
  <section class="myc-section" data-section="scene" v-bind="optionAttributes(section)" :data-variant="section.variant" :aria-labelledby="section.title ? titleId : undefined">
    <div class="myc-section-inner">
      <component :is="renderStatic ? 'div' : 'micelio-scene'" :data-model="renderStatic ? undefined : modelUrl" :data-scene-static="renderStatic ? '' : undefined">
        <SectionMedia :media="poster" sizes="100vw xl:1100px" :eager="eager" />
      </component>
      <SectionHead :title="section.title" :text="section.text" :title-id="titleId" />
    </div>
  </section>
</template>
