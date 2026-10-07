<script setup lang="ts">
import type { TestimonialsSection } from '~/interfaces'

defineProps<{ section: TestimonialsSection }>()

const titleId = useId()
</script>

<template>
  <section class="bd-section" data-section="testimonials" :data-variant="section.variant" :aria-labelledby="section.title ? titleId : undefined">
    <div class="bd-section-inner">
      <SectionHead :title="section.title" :title-id="titleId" />
      <ul class="bd-section-items">
        <li v-for="(item, index) in section.items" :key="index" class="bd-section-item">
          <figure>
            <blockquote class="bd-section-quote">
              <p>{{ item.quote }}</p>
            </blockquote>
            <figcaption class="bd-section-author">
              <SectionMedia v-if="item.avatar" :media="item.avatar" sizes="48px" decorative />
              <span>
                <strong>{{ item.author }}</strong>
                <span v-if="item.role"> · {{ item.role }}</span>
              </span>
            </figcaption>
          </figure>
        </li>
      </ul>
    </div>
  </section>
</template>
