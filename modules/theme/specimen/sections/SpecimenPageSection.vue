<script setup lang="ts">
import type { PageSectionKind } from '~/interfaces'
import SectionRenderer from '~/components/section/SectionRenderer.vue'
import { PAGE_SECTIONS } from '../fixtures'

// One group per section kind: every variant goes through the real SectionRenderer
const props = defineProps<{ kind: PageSectionKind }>()

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
