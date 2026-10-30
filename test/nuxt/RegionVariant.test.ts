import { beforeEach, describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import type { PostListItem } from '~/interfaces'
import RegionPostList from '~/theme/layout/postList/RegionPostList'
import RegionFooter from '~/theme/layout/footer/RegionFooter'

import { STARTER_THEME_DATA, setThemeData } from './themeData'

const PROPS: { posts: PostListItem[], view: 'grid', federated: boolean } = { posts: [], view: 'grid', federated: false }

beforeEach(() => {
  setThemeData({ layout: { ...STARTER_THEME_DATA.layout } })
})

describe('a region component', () => {
  it('renders the variant the active theme chose', async () => {
    setThemeData({ layout: { ...STARTER_THEME_DATA.layout, postList: 'list', footer: 'minimal' } })
    const list = await mountSuspended(RegionPostList, { props: PROPS })
    await flushPromises()
    expect(list.find('[data-layout="list"]').exists()).toBe(true)
    const footer = await mountSuspended(RegionFooter)
    await flushPromises()
    expect(footer.find('footer[data-layout="minimal"]').exists()).toBe(true)
  })

  it('renders the first variant when the theme names one the core does not have', async () => {
    setThemeData({ layout: { ...STARTER_THEME_DATA.layout, postList: 'masonry' } })
    const wrapper = await mountSuspended(RegionPostList, { props: PROPS })
    await flushPromises()
    expect(wrapper.find('[data-layout="grid"]').exists()).toBe(true)
  })

  it('passes attributes and listeners through to the variant', async () => {
    setThemeData({ layout: { ...STARTER_THEME_DATA.layout, postList: 'grid' } })
    const wrapper = await mountSuspended(RegionPostList, { props: PROPS, attrs: { 'data-probe': 'x' } })
    await flushPromises()
    expect(wrapper.find('[data-layout="grid"][data-probe="x"]').exists()).toBe(true)
  })
})
