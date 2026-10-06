<script setup lang="ts">
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
    :to="`${localizePath('/blog')}?category=${category}`"
    :class="['bd-guide-card', { 'bd-guide-pillar': pillar }]"
  >
    <div class="bd-guide-head">
      <BdCategoryTag :category="category" />
      <span class="bd-meta bd-guide-label">{{ label }}</span>
    </div>
    <div class="bd-guide-art">
      <ThemeIllustration :category="category" :size="200" />
    </div>
    <h3 class="bd-guide-title">{{ t(`home.guide.topics.${category}.title`) }}</h3>
    <p v-if="pillar" class="bd-guide-description">{{ t(`home.guide.topics.${category}.description`) }}</p>
    <div class="bd-guide-species">
      <p v-if="caption(category)" class="bd-guide-bird">{{ caption(category)!.name }} · <i>{{ caption(category)!.scientific }}</i></p>
      <p v-if="pillar && note" class="bd-guide-note">{{ note }}</p>
    </div>
    <div class="bd-meta bd-guide-foot">
      <span><span v-if="pillar" class="bd-guide-foot-pillar">{{ label }} · </span>{{ countLabel }}</span>
      <span class="bd-card-arrow" aria-hidden="true">→</span>
    </div>
  </NuxtLink>
</template>
