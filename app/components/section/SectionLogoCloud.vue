<script setup lang="ts">
import type { LogoCloudSection } from '~/interfaces'
import { resolveSectionLink } from '~/helpers/links'

const props = defineProps<{ section: LogoCloudSection }>()

const { getLocalePrefix, localizePath } = useLocaleUtils()
const titleId = useId()
const isMarquee = computed<boolean>(() => props.section.variant === 'marquee')

// Logos link to other sites only
function logoHref(url: string | undefined): string | undefined {
  const target = url ? resolveSectionLink(url, getLocalePrefix(), localizePath) : null
  return target?.external && /^https?:/i.test(target.href) ? target.href : undefined
}
</script>

<template>
  <section class="myc-section" data-section="logo-cloud" :data-variant="section.variant" :aria-labelledby="section.title ? titleId : undefined">
    <div class="myc-section-inner">
      <SectionHead :title="section.title" :title-id="titleId" />
      <div class="myc-section-logo-track" :data-variant="section.variant">
        <ul class="myc-section-items">
          <li v-for="(logo, index) in section.logos" :key="index" class="myc-section-item">
            <a v-if="logoHref(logo.url)" :href="logoHref(logo.url)" rel="noopener">
              <SectionMedia :media="logo.image" sizes="160px" :fallback-alt="logo.name" />
            </a>
            <SectionMedia v-else :media="logo.image" sizes="160px" :fallback-alt="logo.name" />
          </li>
        </ul>
        <!-- Marquee loop: the same logos again, out of the accessibility tree and of the focus order; CSS shows it only while animating -->
        <ul v-if="isMarquee" class="myc-section-items" aria-hidden="true" inert>
          <li v-for="(logo, index) in section.logos" :key="index" class="myc-section-item">
            <SectionMedia :media="logo.image" sizes="160px" decorative />
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
