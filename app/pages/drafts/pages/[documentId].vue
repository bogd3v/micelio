<script setup lang="ts">
import type { DraftPageResponse, Locale, PageSection, RenderMode } from '~/interfaces'
import { isLocale } from '~/helpers/locale'
import { withoutIndex } from '~/helpers/preview'
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

// The bridge gives the markers in the browser, so the server sends the markup of a published page; `SectionRenderer` binds them by position
const markers = ref<Array<Record<string, string>>>()
async function markBlocks(marked: Array<Record<string, string>>): Promise<void> {
  markers.value = marked
  await nextTick()
}

const { preview, updatedAt } = data.value
// The locale of the draft as the CMS holds it: null for a type that is not localised, which is what the admin asks for in `load-draft`
if (preview && updatedAt) usePreviewFrame({ adminOrigin: preview.adminOrigin, documentId, locale: data.value.page.locale ?? null, version: updatedAt }, { mark: markBlocks, sections: () => data.value?.page.sections, apply: applyPatch, render: renderBlock })

// Shows the admin's unsaved text in the real components, without a reload; the saved draft comes back with `load-draft` (ADR 0019, amendment of 2026-11-02)
async function applyPatch(sections: PageSection[]): Promise<void> {
  if (data.value) data.value = { ...data.value, page: { ...data.value.page, sections } }
  await nextTick()
}

// The blocks the admin asked to see as their static alternative, by position; the mode is the frame's state and a reload clears it (ADR 0019, amendment of 2026-11-04)
const staticBlocks = ref<ReadonlySet<number>>(new Set())
async function renderBlock(index: number, mode: RenderMode): Promise<void> {
  const next = new Set(staticBlocks.value)
  if (mode === 'static') next.add(index)
  else next.delete(index)
  staticBlocks.value = next
  await nextTick()
}
</script>

<template>
  <div v-if="data" :data-myc-zone="markers ? 'sections' : undefined">
    <SectionRenderer :sections="data.page.sections" :page-title="data.page.title" :markers="markers" :static-blocks="staticBlocks" />
  </div>
</template>
