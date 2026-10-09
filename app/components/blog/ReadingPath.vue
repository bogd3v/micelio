<script setup lang="ts">
import type { Category, ReadingPath, ReadingPathStep } from '~/interfaces'
import { padCount } from '~/helpers/search'

const MIN_STEPS = 2

const props = defineProps<{
  category: Category
  currentDocumentId?: string
}>()

const { t, locale } = useI18n()
const { localizePath } = useLocaleUtils()
const { isRead } = useReadArticles()

const { data: path } = useFetch<ReadingPath>('/api/reading-path', {
  key: `reading-path-${props.category}-${locale.value}`,
  query: { category: props.category, locale: locale.value },
})

const steps = computed<ReadingPathStep[]>(() => path.value?.steps ?? [])
const currentIndex = computed<number>(() => steps.value.findIndex(step => step.documentId === props.currentDocumentId))
const visible = computed<boolean>(() =>
  steps.value.length >= MIN_STEPS && (!props.currentDocumentId || currentIndex.value !== -1),
)
const next = computed<ReadingPathStep | undefined>(() =>
  currentIndex.value === -1 ? undefined : steps.value[currentIndex.value + 1],
)
const readCount = computed<number>(() => steps.value.filter(step => isRead(step.documentId)).length)
const title = computed<string>(() => t('blog.path.title', { category: t(`myc.categoryShort.${props.category}`) }))
const progress = computed<string>(() =>
  t('blog.path.progress', { read: padCount(readCount.value), total: padCount(steps.value.length) }),
)
const headingId = computed<string>(() => `myc-path-${props.category}${props.currentDocumentId ? '-article' : ''}`)

function stepHref(step: ReadingPathStep): string {
  return `${localizePath('/blog')}/${step.slug}`
}
</script>

<template>
  <section v-if="visible" :class="['myc-path', { 'myc-path-article': currentDocumentId }]" :aria-labelledby="headingId">
    <h2 :id="headingId" class="myc-eyebrow myc-home-eyebrow">{{ title }}</h2>
    <ol class="myc-path-list">
      <li
        v-for="(step, index) in steps"
        :key="step.documentId"
        :class="['myc-path-step', { 'myc-path-step-current': index === currentIndex }]"
      >
        <span class="myc-path-number" aria-hidden="true">{{ padCount(index + 1) }}</span>
        <NuxtLink
          :to="stepHref(step)"
          class="myc-path-link"
          :aria-current="index === currentIndex ? 'page' : undefined"
        >
          {{ step.title }}
        </NuxtLink>
        <span v-if="isRead(step.documentId)" class="myc-meta myc-read-mark myc-path-read">
          <span aria-hidden="true">✓</span><span class="myc-sr">{{ t('myc.card.read') }}</span>
        </span>
      </li>
    </ol>
    <p class="myc-meta myc-path-progress">{{ progress }}</p>
    <NuxtLink v-if="next" :to="stepHref(next)" class="myc-path-next">
      <span class="myc-eyebrow myc-home-eyebrow">{{ t('blog.path.next') }}</span>
      <span class="myc-path-next-title">{{ next.title }} <span aria-hidden="true">→</span></span>
    </NuxtLink>
    <p v-else-if="currentDocumentId" class="myc-meta myc-path-progress">{{ t('blog.path.done') }}</p>
  </section>
</template>
