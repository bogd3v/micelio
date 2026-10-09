import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import ThemeIllustration from '~~/themes/bogota/slots/ThemeIllustration.vue'
import DefaultIllustration from '~/theme/defaults/ThemeIllustration.vue'
import { useIllustrationCaption } from '~/composables/useIllustrationCaption'
import { useCategoryLabel } from '~/composables/useCategoryLabel'
import { CATEGORIES } from '~/constants/categories'
import { Category } from '~/interfaces/design'

describe('ThemeIllustration (Bogotá)', () => {
  it('draws a distinct bird for each category in its color', async () => {
    const drawings = new Set<string>()
    for (const category of CATEGORIES) {
      const wrapper = await mountSuspended(ThemeIllustration, { props: { category, size: 160 } })
      const svg = wrapper.get('svg')
      expect(svg.attributes('aria-hidden')).toBe('true')
      expect(svg.attributes('width')).toBe('160')
      expect(svg.attributes('height')).toBe('120')
      expect(svg.attributes('style')).toContain('var(--')
      expect(svg.findAll('path').length).toBeGreaterThan(3)
      drawings.add(svg.html())
    }
    expect(drawings.size).toBe(5)
  })
})

describe('ThemeIllustration (core default)', () => {
  it('draws nothing', async () => {
    const wrapper = await mountSuspended(DefaultIllustration, { props: { category: Category.Diy, size: 160 } })
    expect(wrapper.find('svg').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })
})

describe('useIllustrationCaption', () => {
  it('reads the theme messages of each category', async () => {
    let caption: ReturnType<typeof useIllustrationCaption> = () => null
    await mountSuspended(defineComponent({
      setup() {
        caption = useIllustrationCaption()
        return () => h('div')
      },
    }))
    expect(CATEGORIES.map(category => caption(category))).toEqual([
      { name: 'Masked flowerpiercer', scientific: 'Diglossa cyanea' },
      { name: 'Blue-and-white swallow', scientific: 'Pygochelidon cyanoleuca' },
      { name: 'Sparkling violetear', scientific: 'Colibri coruscans' },
      { name: 'Great thrush', scientific: 'Turdus fuscater' },
      { name: 'Yellow-hooded blackbird', scientific: 'Chrysomus icterocephalus bogotensis' },
    ])
    expect(caption('unknown' as Category)).toBeNull()
  })
})

describe('useCategoryLabel', () => {
  it('translates known slugs and falls back to the Strapi name', async () => {
    let label: ReturnType<typeof useCategoryLabel> = () => ''
    await mountSuspended(defineComponent({
      setup() {
        label = useCategoryLabel()
        return () => h('div')
      },
    }))
    expect(label({ slug: Category.Ai, name: 'Inteligencia artificial' })).toBe('Artificial intelligence')
    expect(label({ slug: Category.Diy })).toBe('DIY · Do it yourself')
    expect(label({ slug: null, name: 'Tech culture' })).toBe('Tech culture')
    expect(label(null)).toBe('')
  })
})
