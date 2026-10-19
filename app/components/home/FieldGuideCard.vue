<script setup lang="ts">
import { blogPath } from '~/helpers/blog'
import { padCount } from '~/helpers/search'

const props = defineProps<{
  /** Slug of a category of the CMS */
  category: string
  count: number
  figure: number
  /** The number of a featured category among the pillars of the guide */
  pillar?: number
}>()

const { t } = useI18n()
const { categories, colorOf } = useCategories()
const { localizePath } = useLocaleUtils()

const caption = useIllustrationCaption()
const themeMessage = useThemeMessage()

const entry = computed(() => categories.value.find(category => category.slug === props.category))
const label = computed<string>(() =>
  props.pillar
    ? t('home.guide.pillar', { number: padCount(props.pillar) })
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
      <MycCategoryTag :category="category" />
      <span class="myc-meta myc-guide-label">{{ label }}</span>
    </div>
    <div class="myc-guide-art">
      <ThemeIllustration :category="category" :color="colorOf(category)" :size="200" />
    </div>
    <h3 class="myc-guide-title">{{ entry?.name ?? category }}</h3>
    <p v-if="pillar && entry?.description" class="myc-guide-description">{{ entry.description }}</p>
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
