import { beforeEach, describe, it, expect, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h, watchEffect } from 'vue'
import DefaultIllustration from '~/theme/defaults/ThemeIllustration.vue'
import { useIllustrationCaption } from '~/composables/useIllustrationCaption'
import { useCategoryLabel } from '~/composables/useCategoryLabel'
import MycCategoryTag from '~/components/myc/MycCategoryTag.vue'
import { categoryColor } from '~/helpers/categories'
import { GARDEN_CATEGORIES, serveCategories } from './categoriesFixture'
import { mergeThemeMessages } from './themeData'

describe('ThemeIllustration (core default)', () => {
  it('draws nothing, for any slug', async () => {
    for (const category of ['diy', 'garden']) {
      const wrapper = await mountSuspended(DefaultIllustration, { props: { category, color: 'var(--category-1)', size: 160 } })
      expect(wrapper.find('svg').exists()).toBe(false)
      expect(wrapper.text()).toBe('')
    }
  })
})

describe('useIllustrationCaption', () => {
  it('reads the theme messages of the slugs it knows and gives null for any other', async () => {
    mergeThemeMessages({ illustration: { garden: { name: 'Hoopoe', scientific: 'Upupa epops' }, kitchen: { name: 'Robin' } } })
    let caption: ReturnType<typeof useIllustrationCaption> = () => null
    await mountSuspended(defineComponent({
      setup() {
        caption = useIllustrationCaption()
        return () => h('div')
      },
    }))
    expect(caption('garden')).toEqual({ name: 'Hoopoe', scientific: 'Upupa epops' })
    expect(caption('kitchen')).toEqual({ name: 'Robin', scientific: '' })
    expect(caption('cellar')).toBeNull()
  })
})

describe('colorOf and categoryColor', () => {
  beforeEach(() => serveCategories())

  it('give a slug the same color: the composable is the helper applied to its list, and the tag shows it', async () => {
    let colors: Array<[string, string]> = []
    await mountSuspended(defineComponent({
      setup() {
        const { categories, colorOf } = useCategories()
        watchEffect(() => {
          colors = categories.value.map(category => [colorOf(category.slug), categoryColor(categories.value, category.slug)])
        })
        return () => h('div')
      },
    }))
    await vi.waitFor(() => expect(colors).toHaveLength(GARDEN_CATEGORIES.length))
    for (const [fromComposable, fromHelper] of colors) expect(fromComposable).toBe(fromHelper)
    expect(colors.map(([color]) => color)).toEqual(['var(--category-1)', 'var(--category-2)', 'var(--category-3)', 'var(--category-4)', 'var(--category-5)', 'var(--category-1)'])
    const tag = await mountSuspended(MycCategoryTag, { props: { category: 'loft' } })
    await vi.waitFor(() => expect(tag.attributes('style')).toContain(`--tag-color: ${colors[5]![0]}`))
  })
})

describe('useCategoryLabel', () => {
  it('gives the localized name of the list, else the name it came with, else the slug', async () => {
    serveCategories()
    let label: ReturnType<typeof useCategoryLabel> = () => ''
    await mountSuspended(defineComponent({
      setup() {
        label = useCategoryLabel()
        return () => h('div')
      },
    }))
    await vi.waitFor(() => expect(label({ slug: 'garden', name: 'Jardín' })).toBe('Garden'))
    expect(label({ slug: 'kitchen' })).toBe('Kitchen')
    expect(label({ slug: 'attic', name: 'Attic' })).toBe('Attic')
    expect(label({ slug: 'attic' })).toBe('attic')
    expect(label({ slug: null, name: 'Tech culture' })).toBe('Tech culture')
    expect(label(null)).toBe('')
  })
})
