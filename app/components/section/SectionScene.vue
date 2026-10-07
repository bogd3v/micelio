<script setup lang="ts">
import type { PageMedia, SceneSection } from '~/interfaces'

const props = defineProps<{ section: SceneSection }>()

const titleId = useId()

// The static fallback: the poster, described by the scene's alt text (the 3D island arrives with #246)
const poster = computed<PageMedia>(() => ({ ...props.section.poster, alternativeText: props.section.alt }))
</script>

<template>
  <section class="bd-section" data-section="scene" :data-variant="section.variant" :aria-labelledby="section.title ? titleId : undefined">
    <div class="bd-section-inner">
      <SectionMedia :media="poster" sizes="100vw xl:1100px" />
      <SectionHead :title="section.title" :text="section.text" :title-id="titleId" />
    </div>
  </section>
</template>
