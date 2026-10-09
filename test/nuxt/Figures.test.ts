import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MycFigureCredit from '~/components/myc/MycFigureCredit.vue'
import StrapiMediaBlock from '~/components/strapi/MediaBlock.vue'
import StrapiSliderBlock from '~/components/strapi/SliderBlock.vue'
import StrapiBlocksRenderer from '~/components/strapi/BlocksRenderer.vue'
import type { StrapiBlock, StrapiImageCredit, StrapiMedia, StrapiSlider } from '~/interfaces'

const photo: StrapiImageCredit = {
  kind: 'photo',
  author: 'Danielfjio',
  authorUrl: 'https://commons.wikimedia.org/wiki/User:Danielfjio',
  source: 'Wikimedia Commons',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Paisaje_Sumapaz,_Colombia.jpg',
  license: 'cc-by-sa-4.0',
  modifications: 'cropped',
}

const illustration: StrapiImageCredit = { kind: 'illustration', author: 'Alejandro Ramírez', source: 'BogDev', license: 'own-work' }

describe('MycFigureCredit', () => {
  it('links author, source and license', async () => {
    const wrapper = await mountSuspended(MycFigureCredit, { props: { credit: photo } })
    expect(wrapper.text()).toBe('Photo Danielfjio · Wikimedia Commons · CC BY-SA 4.0 · cropped')
    expect(wrapper.get('.myc-credit-k').text()).toBe('Photo')
    const links = wrapper.findAll('a')
    expect(links.map(link => link.attributes('href'))).toEqual([
      'https://commons.wikimedia.org/wiki/User:Danielfjio',
      'https://commons.wikimedia.org/wiki/File:Paisaje_Sumapaz,_Colombia.jpg',
      'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
    ])
    expect(links[2]!.attributes()).toMatchObject({ 'rel': 'license noopener noreferrer', 'target': '_blank', 'aria-label': 'CC BY-SA 4.0 (opens in a new tab)' })
    expect(links[0]!.attributes('rel')).toBe('noopener noreferrer')
  })

  it('shows own work without links', async () => {
    const wrapper = await mountSuspended(MycFigureCredit, { props: { credit: illustration } })
    expect(wrapper.text()).toBe('Illustration Alejandro Ramírez · BogDev · own work')
    expect(wrapper.find('a').exists()).toBe(false)
  })
})

describe('StrapiMediaBlock', () => {
  const block: StrapiMedia = { id: 1, __component: 'shared.media', file: { url: '/a.jpg', alternativeText: 'Laguna' }, caption: 'A lagoon.', credit: photo }

  it('renders a numbered figure with caption and credit', async () => {
    const wrapper = await mountSuspended(StrapiMediaBlock, { props: { block, figureNumber: 2 } })
    expect(wrapper.get('figure').classes()).toContain('myc-fig')
    expect(wrapper.get('.myc-fig-media img').attributes('alt')).toBe('Laguna')
    expect(wrapper.get('.myc-fig-cap').text()).toBe('Fig. 02 A lagoon.')
    expect(wrapper.find('figcaption .myc-credit').exists()).toBe(true)
  })

  it('falls back to the media library caption', async () => {
    const wrapper = await mountSuspended(StrapiMediaBlock, {
      props: { block: { ...block, caption: null, credit: null, file: { url: '/a.jpg', caption: 'Library' } }, figureNumber: 1 },
    })
    expect(wrapper.get('.myc-fig-cap').text()).toBe('Fig. 01 Library')
    expect(wrapper.find('.myc-credit').exists()).toBe(false)
  })

  it('has no caption without caption or credit', async () => {
    const wrapper = await mountSuspended(StrapiMediaBlock, { props: { block: { ...block, caption: null, credit: null } } })
    expect(wrapper.find('figcaption').exists()).toBe(false)
  })
})

describe('StrapiSliderBlock', () => {
  const slider: StrapiSlider = {
    id: 3,
    __component: 'shared.slider',
    items: [
      { file: { url: '/a.jpg' }, caption: 'First slide', credit: photo },
      { file: { url: '/b.jpg' }, caption: 'Second slide', credit: illustration },
    ],
  }

  it('changes the caption and credit with the active slide and announces it', async () => {
    const wrapper = await mountSuspended(StrapiSliderBlock, { props: { block: slider, figureNumber: 3 } })
    const caption = wrapper.get('figcaption')
    expect(caption.attributes('aria-live')).toBe('polite')
    expect(caption.get('.myc-fig-cap').text()).toBe('Fig. 03 First slide')
    expect(caption.get('.myc-credit-k').text()).toBe('Photo')
    await wrapper.get('button[aria-label="Next slide"]').trigger('click')
    expect(wrapper.get('.myc-fig-cap').text()).toBe('Fig. 03 Second slide')
    expect(wrapper.get('.myc-credit').text()).toBe('Illustration Alejandro Ramírez · BogDev · own work')
  })

  it('still shows legacy files', async () => {
    const wrapper = await mountSuspended(StrapiSliderBlock, {
      props: { block: { id: 4, __component: 'shared.slider', files: [{ url: '/a.jpg' }, { url: '/b.jpg' }] } },
    })
    expect(wrapper.findAll('img')).toHaveLength(2)
    expect(wrapper.find('figcaption').exists()).toBe(false)
  })
})

describe('StrapiBlocksRenderer', () => {
  it('numbers the figures of the article in order', async () => {
    const blocks = [
      { id: 1, __component: 'shared.media', file: { url: '/a.jpg' }, caption: 'One' },
      { id: 2, __component: 'shared.rich-text', body: 'Text' },
      { id: 3, __component: 'shared.media', file: { url: '/b.jpg' }, credit: illustration },
    ] as StrapiBlock[]
    const wrapper = await mountSuspended(StrapiBlocksRenderer, { props: { blocks } })
    expect(wrapper.findAll('.myc-fig-n').map(number => number.text())).toEqual(['Fig. 01', 'Fig. 02'])
    expect(wrapper.find('[figure-number]').exists()).toBe(false)
  })
})
