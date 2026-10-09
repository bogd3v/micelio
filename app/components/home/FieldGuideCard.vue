<script setup lang="ts">
import { blogPath } from '~/helpers/blog'
import type { Category } from '~/interfaces'
import { CATEGORY_INFO } from '~/helpers/categories'
import { padCount } from '~/helpers/search'

const props = defineProps<{
  category: Category
  count: number
  figure: number
}>()

const { t } = useI18n()
const { localizePath } = useLocaleUtils()

const caption = useIllustrationCaption()
const themeMessage = useThemeMessage()

const pillar = computed<number | null>(() => CATEGORY_INFO[props.category].pillar)
const label = computed<string>(() =>
  pillar.value
    ? t('home.guide.pillar', { number: padCount(pillar.value) })
    : t('home.guide.figure', { number: padCount(props.figure) }),
)
const note = computed<string>(() => themeMessage(`guide.note.${props.category}`))
const countLabel = computed<string>(() => t('home.guide.count', { count: padCount(props.count) }, props.count))
</script>

<template>
  <NuxtLink
    :to="blogPath({ category: props.category, page: 1 }, localizePath('/blog'))"
    :class="['myc-guide-card', { 'myc-guide-pillar': pillar }]"
  >
    <div class="myc-guide-head">
      <BdCategoryTag :category="category" />
      <span class="myc-meta myc-guide-label">{{ label }}</span>
    </div>
    <div class="myc-guide-art">
      <ThemeIllustration :category="category" :size="200" />
    </div>
    <h3 class="myc-guide-title">{{ t(`home.guide.topics.${category}.title`) }}</h3>
    <p v-if="pillar" class="myc-guide-description">{{ t(`home.guide.topics.${category}.description`) }}</p>
    <div class="myc-guide-species">
      <p v-if="caption(category)" class="myc-guide-bird">{{ caption(category)!.name }} · <i>{{ caption(category)!.scientific }}</i></p>
      <p v-if="pillar && note" class="myc-guide-note">{{ note }}</p>
    </div>
    <div class="myc-meta myc-guide-foot">
      <span><span v-if="pillar" class="myc-guide-foot-pillar">{{ label }} · </span>{{ countLabel }}</span>
      <span class="myc-card-arrow" aria-hidden="true">→</span>
    </div>
  </NuxtLink>
</template>
