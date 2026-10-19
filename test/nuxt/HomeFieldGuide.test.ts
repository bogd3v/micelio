import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { FieldGuideTopic } from '~/interfaces'
import { fieldGuideTopics } from '~/helpers/categoryList'
import HomeFieldGuide from '~/components/home/FieldGuide.vue'
import { GARDEN_CATEGORIES, categoriesSettled, serveCategories } from './categoriesFixture'

const topics: FieldGuideTopic[] = fieldGuideTopics(GARDEN_CATEGORIES, 6)

describe('HomeFieldGuide', () => {
  beforeEach(() => serveCategories())

  it('shows a card per non-empty category with the CMS name, the featured ones as numbered pillars', async () => {
    const wrapper = await mountSuspended(HomeFieldGuide, { props: { topics } })
    await vi.waitFor(() => expect(wrapper.findAll('.myc-guide-pillar')).toHaveLength(2))
    expect(wrapper.findAll('.myc-guide-title').map(title => title.text())).toEqual(['Garden', 'Kitchen', 'Workshop', 'Cellar', 'Loft'])
    expect(wrapper.findAll('.myc-guide-pillar .myc-guide-label').map(label => label.text())).toEqual(['Pillar 01', 'Pillar 02'])
    expect(wrapper.findAll('.myc-guide-pillar .myc-guide-description').map(text => text.text())).toEqual(['About Garden', 'About Kitchen'])
    expect(wrapper.findAll('a.myc-guide-card').map(card => card.attributes('href')).slice(0, 2)).toEqual(['/blog/category/garden', '/blog/category/kitchen'])
  })

  it('renders nothing without topics', async () => {
    serveCategories([])
    const wrapper = await mountSuspended(HomeFieldGuide, { props: { topics: [] } })
    await categoriesSettled()
    expect(wrapper.find('section').exists()).toBe(false)
  })
})
