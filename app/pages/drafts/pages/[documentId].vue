<script setup lang="ts">
import type { BlockPatch, DraftPageResponse, Locale } from '~/interfaces'
import { isLocale } from '~/helpers/locale'
import { withoutIndex } from '~/helpers/preview'
import { knownSections } from '~/helpers/pages'
import { blockMarkers, patchSections } from '~/helpers/previewBlocks'
import { pageTitle } from '~/helpers/site'

definePageMeta({ middleware: 'editor', previewGrant: true })

const { locale, t } = useI18n()
const site = useSite()
const route = useRoute()
const requestFetch = useRequestFetch()
const { setAlternates } = useLocaleAlternates()

const documentId = route.params.documentId as string
const draftLocale: Locale = isLocale(route.query.locale) ? route.query.locale : locale.value as Locale

const { data, error } = await useAsyncData<DraftPageResponse>(
  `draft-page-${documentId}-${draftLocale}`,
  () => requestFetch<DraftPageResponse>(`/api/drafts/pages/${encodeURIComponent(documentId)}`, { query: { locale: draftLocale, without: withoutIndex(route.query.without) } }),
)

if (error.value || !data.value) {
  const statusCode = error.value?.statusCode ?? 404
  throw createError({ statusCode, statusMessage: statusCode === 404 ? 'Page not found' : 'Failed to load draft', fatal: true })
}

setAlternates({})
useStaticPreview()

useSeoMeta({
  title: () => pageTitle(t('drafts.meta.article', { title: data.value?.page.title ?? '' }), site.value.name),
  robots: 'noindex, nofollow',
})

const { preview, updatedAt } = data.value
// The locale of the draft as the CMS holds it: null for a type that is not localised, which is what the admin asks for in `load-draft`
if (preview && updatedAt) usePreviewFrame({ adminOrigin: preview.adminOrigin, documentId, locale: data.value.page.locale ?? null, version: updatedAt }, { patch: patchBlock })

// The markers follow the sections the renderer shows, so a patch in the browser finds a block by the position it was rendered at
const markers = computed(() => preview && data.value ? knownSections(data.value.page.sections).map((section, index) => blockMarkers(section.__component, index)) : undefined)

// Shows the admin's unsaved text in the real components, without a reload; the saved draft comes back with `load-draft` (ADR 0019, amendment of 2026-11-02)
function patchBlock(patch: BlockPatch): boolean {
  const current = data.value
  const sections = current ? patchSections(current.page.sections, patch) : undefined
  if (!current || !sections) return false
  data.value = { ...current, page: { ...current.page, sections } }
  return true
}
</script>

<template>
  <div v-if="data" :data-myc-zone="preview ? 'sections' : undefined">
    <SectionRenderer :sections="data.page.sections" :page-title="data.page.title" :markers="markers" />
  </div>
</template>
