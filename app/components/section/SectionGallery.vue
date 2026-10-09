<script setup lang="ts">
import type { GallerySection } from '~/interfaces'

defineProps<{ section: GallerySection }>()

const titleId = useId()
</script>

<template>
  <section class="myc-section" data-section="gallery" :data-variant="section.variant" :aria-labelledby="section.title ? titleId : undefined">
    <div class="myc-section-inner">
      <SectionHead :title="section.title" :title-id="titleId" />
      <ul class="myc-section-items">
        <li v-for="(image, index) in section.images" :key="index" class="myc-section-item">
          <SectionMedia :media="image" sizes="100vw sm:50vw lg:33vw" />
        </li>
      </ul>
    </div>
  </section>
</template>
