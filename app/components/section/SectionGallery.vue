<script setup lang="ts">
import type { GallerySection } from '~/interfaces'

defineProps<{ section: GallerySection }>()

const titleId = useId()
</script>

<template>
  <section class="bd-section" data-section="gallery" :data-variant="section.variant" :aria-labelledby="section.title ? titleId : undefined">
    <div class="bd-section-inner">
      <SectionHead :title="section.title" :title-id="titleId" />
      <ul class="bd-section-items">
        <li v-for="(image, index) in section.images" :key="index" class="bd-section-item">
          <SectionMedia :media="image" sizes="100vw sm:50vw lg:33vw" />
        </li>
      </ul>
    </div>
  </section>
</template>
