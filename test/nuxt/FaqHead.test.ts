import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import SectionRenderer from '~/components/section/SectionRenderer.vue'
import type { FaqItem, PageSection } from '~/interfaces'

function faq(...items: FaqItem[]): PageSection {
  return { __component: 'section.faq', variant: 'list', title: 'Questions', items }
}

function faqScripts(): Array<{ mainEntity: Array<{ name: string }> }> {
  return [...document.head.querySelectorAll('script[type="application/ld+json"]')]
    .map(script => JSON.parse(script.textContent ?? '{}'))
    .filter(data => data['@type'] === 'FAQPage')
}

describe('the head of a page with faq blocks', () => {
  it('has one FAQPage script with the questions of every faq block, and none without a faq block', async () => {
    const wrapper = await mountSuspended(SectionRenderer, {
      props: {
        sections: [
          faq({ question: 'First?', html: '<p>One.</p>' }),
          { __component: 'section.cta', variant: 'card', title: 'Go' },
          faq({ question: 'Second?', html: '<p>Two.</p>' }),
        ],
      },
    })
    await vi.waitFor(() => expect(faqScripts()).toHaveLength(1))
    const found = faqScripts()
    expect(found[0]!.mainEntity.map(question => question.name)).toEqual(['First?', 'Second?'])
    wrapper.unmount()
    await vi.waitFor(() => expect(faqScripts()).toHaveLength(0))

    const without = await mountSuspended(SectionRenderer, { props: { sections: [{ __component: 'section.cta', variant: 'card', title: 'Go' }] } })
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(faqScripts()).toHaveLength(0)
    without.unmount()
  })
})
