<script setup lang="ts">
import type { PageSectionKind } from '~/interfaces'
import SectionRenderer from '~/components/section/SectionRenderer.vue'
import { TRUSTED_MEDIA_PREFIX } from '~/helpers/trustedMedia'
import { PAGE_SECTIONS } from '../fixtures'

// One group per section kind: every variant goes through the real SectionRenderer
const props = defineProps<{ kind: PageSectionKind }>()

// The specimen's own images: the only provider of a trusted media prefix (app/helpers/trustedMedia.ts)
provide(TRUSTED_MEDIA_PREFIX, '/_theme/media/')

const { t } = useI18n()
const newsletter = useModule('newsletter')

const entries = computed(() => PAGE_SECTIONS.filter(entry => entry.kind === props.kind))
const unavailable = computed<boolean>(() => props.kind === 'newsletter' && !newsletter.value)
</script>

<template>
  <p v-if="unavailable" class="bd-body-s">{{ t('specimen.pageSections.newsletterOff') }}</p>
  <div v-else class="bd-specimen-stack">
    <div v-for="entry in entries" :key="entry.variant" :data-specimen-variant="entry.variant || undefined">
      <h3 class="bd-specimen-label">{{ entry.variant || t('specimen.pageSections.noVariant') }}</h3>
      <div class="bd-specimen-frame">
        <SectionRenderer :sections="[entry.section]" />
      </div>
    </div>
  </div>
</template>
