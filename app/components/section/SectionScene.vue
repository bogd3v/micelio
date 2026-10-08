<script setup lang="ts">
import type { PageMedia, SceneSection } from '~/interfaces'

const props = defineProps<{ section: SceneSection }>()

const { getMediaUrl } = useStrapi()
const titleId = useId()

// The static fallback: the poster, described by the scene's alt text
const poster = computed<PageMedia>(() => ({ ...props.section.poster, alternativeText: props.section.alt }))

// The model's URL: static builds copy it into /_media/ and rewrite it, and the dynamic CSP names its origin (ADR 0004)
const modelUrl = computed<string>(() => getMediaUrl(props.section.model.url))
</script>

<template>
  <section class="bd-section" data-section="scene" :data-variant="section.variant" :aria-labelledby="section.title ? titleId : undefined">
    <div class="bd-section-inner">
      <micelio-scene :data-model="modelUrl" :data-variant="section.variant">
        <SectionMedia :media="poster" sizes="100vw xl:1100px" />
      </micelio-scene>
      <SectionHead :title="section.title" :text="section.text" :title-id="titleId" />
    </div>
  </section>
</template>
