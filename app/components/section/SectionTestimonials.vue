<script setup lang="ts">
import type { TestimonialsSection } from '~/interfaces'

const props = defineProps<{ section: TestimonialsSection }>()

const titleId = useId()
// single shows the first quotation only
const items = computed(() => props.section.variant === 'single' ? props.section.items.slice(0, 1) : props.section.items)
</script>

<template>
  <section class="myc-section" data-section="testimonials" :data-variant="section.variant" :aria-labelledby="section.title ? titleId : undefined">
    <div class="myc-section-inner">
      <SectionHead :title="section.title" :title-id="titleId" />
      <ul class="myc-section-items">
        <li v-for="(item, index) in items" :key="index" class="myc-section-item">
          <figure>
            <blockquote class="myc-section-quote">
              <p>{{ item.quote }}</p>
            </blockquote>
            <figcaption class="myc-section-author">
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
