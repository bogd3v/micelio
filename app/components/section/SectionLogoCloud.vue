<script setup lang="ts">
import type { LogoCloudSection } from '~/interfaces'

const props = defineProps<{ section: LogoCloudSection }>()

const titleId = useId()
const isMarquee = computed<boolean>(() => props.section.variant === 'marquee')
</script>

<template>
  <section class="bd-section" data-section="logo-cloud" :data-variant="section.variant" :aria-labelledby="section.title ? titleId : undefined">
    <div class="bd-section-inner">
      <SectionHead :title="section.title" :title-id="titleId" />
      <div class="bd-section-logo-track" :data-variant="section.variant">
        <ul class="bd-section-items">
          <li v-for="(logo, index) in section.logos" :key="index" class="bd-section-item">
            <SectionMedia v-if="!logo.url" :media="logo.image" sizes="160px" :fallback-alt="logo.name" />
            <a v-else :href="logo.url" rel="noopener">
              <SectionMedia :media="logo.image" sizes="160px" :fallback-alt="logo.name" />
            </a>
          </li>
        </ul>
        <!-- Marquee loop: the same logos again, out of the accessibility tree and of the focus order; CSS shows it only while animating -->
        <ul v-if="isMarquee" class="bd-section-items" aria-hidden="true" inert>
          <li v-for="(logo, index) in section.logos" :key="index" class="bd-section-item">
            <SectionMedia :media="logo.image" sizes="160px" decorative />
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
