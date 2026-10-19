import { beforeEach, describe, it, expect, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MycCategoryTag from '~/components/myc/MycCategoryTag.vue'
import { categoriesSettled, serveCategories } from './categoriesFixture'

describe('MycCategoryTag', () => {
  beforeEach(() => serveCategories())

  it('shows the CMS name with the color of its position', async () => {
    const wrapper = await mountSuspended(MycCategoryTag, { props: { category: 'kitchen' } })
    expect(wrapper.element.tagName).toBe('SPAN')
    await vi.waitFor(() => expect(wrapper.text()).toBe('Kitchen'))
    expect(wrapper.attributes('style')).toContain('--tag-color: var(--category-2)')
    expect(wrapper.get('.myc-tag-dot').attributes('aria-hidden')).toBe('true')
  })

  it('wraps the color after the fifth category and shows the slug and a neutral color for an unknown one', async () => {
    const sixth = await mountSuspended(MycCategoryTag, { props: { category: 'loft' } })
    await vi.waitFor(() => expect(sixth.text()).toBe('Loft'))
    expect(sixth.attributes('style')).toContain('--tag-color: var(--category-1)')
    const unknown = await mountSuspended(MycCategoryTag, { props: { category: 'attic' } })
    expect(unknown.text()).toBe('attic')
    expect(unknown.attributes('style')).toContain('--tag-color: var(--ink-muted)')
  })

  it('shows the name the post came with when the list does not have the category or failed', async () => {
    const outside = await mountSuspended(MycCategoryTag, { props: { category: 'attic', name: 'The attic' } })
    await categoriesSettled()
    expect(outside.text()).toBe('The attic')
    // A name is only a fallback: the list wins when it has the category
    const listed = await mountSuspended(MycCategoryTag, { props: { category: 'garden', name: 'Jardín' } })
    await vi.waitFor(() => expect(listed.text()).toBe('Garden'))
  })

  it('renders a link and accepts a custom label', async () => {
    const wrapper = await mountSuspended(MycCategoryTag, {
      props: { category: 'garden', href: '/blog/category/garden' },
      slots: { default: () => 'Plants' },
    })
    expect(wrapper.element.tagName).toBe('A')
    expect(wrapper.attributes('href')).toBe('/blog/category/garden')
    expect(wrapper.text()).toBe('Plants')
  })
})
