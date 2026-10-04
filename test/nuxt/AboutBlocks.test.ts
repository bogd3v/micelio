import { describe, it, expect, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { StrapiBlock, StrapiContact, StrapiOpenSource, StrapiPrinciples, StrapiProfile, StrapiProjects, StrapiTopics } from '~/interfaces'
import { aboutBlocks } from '../../e2e/fixtures/about.mjs'
import StrapiBlocksRenderer from '~/components/strapi/BlocksRenderer.vue'
import StrapiProfileBlock from '~/components/strapi/ProfileBlock.vue'
import StrapiTopicsBlock from '~/components/strapi/TopicsBlock.vue'
import StrapiProjectsBlock from '~/components/strapi/ProjectsBlock.vue'
import StrapiPrinciplesBlock from '~/components/strapi/PrinciplesBlock.vue'
import StrapiOpenSourceBlock from '~/components/strapi/OpenSourceBlock.vue'
import StrapiContactBlock from '~/components/strapi/ContactBlock.vue'
import { createMarkdownRenderer, renderBlocks } from '~/helpers/markdown'

const blocks = aboutBlocks('en') as StrapiBlock[]

function block<T extends StrapiBlock>(component: T['__component']): T {
  return blocks.find(item => item.__component === component) as T
}

describe('StrapiBlocksRenderer', () => {
  it('renders the field card blocks in order and skips retired ones', async () => {
    const wrapper = await mountSuspended(StrapiBlocksRenderer, { props: { blocks } })
    expect(wrapper.text()).not.toContain('Retired block')
    expect(wrapper.findAll('h1')).toHaveLength(1)
    expect(wrapper.find('.bd-profile').exists()).toBe(true)
    expect(wrapper.find('.bd-contact-section').exists()).toBe(true)
  })
})

describe('StrapiProfileBlock', () => {
  it('shows the facts, the calls to action and the mascot as fallback', async () => {
    const wrapper = await mountSuspended(StrapiProfileBlock, { props: { block: block<StrapiProfile>('about.profile') } })
    expect(wrapper.get('h1').text()).toBe('Hi, I am Alejandro.')
    expect(wrapper.findAll('dt').map(dt => dt.text())).toEqual(['Name', 'Habitat', 'Specialty', 'Call'])
    expect(wrapper.findAll('dd').at(-1)!.classes()).toContain('font-mono')
    expect(wrapper.findAll('dd').at(-1)!.get('a').attributes('href')).toBe('/#fediverso')
    const links = wrapper.findAll('.bd-profile-actions a')
    expect(links.map(link => link.attributes('href'))).toEqual(['/blog', '#projects'])
    expect(links[0]!.classes()).toContain('bd-btn-primary')
    expect(wrapper.get('.bd-plate-mascot').attributes('alt')).toBe('Illustration of a rufous-collared sparrow, the blog\'s mascot bird')
    expect(wrapper.get('.bd-plate-label').text()).toBe('LÁM. 01')
  })

  it('uses the photo from Strapi when there is one', async () => {
    const profile = { ...block<StrapiProfile>('about.profile'), photo: { url: '/uploads/alejandro.jpg', alternativeText: 'Alejandro' } }
    const wrapper = await mountSuspended(StrapiProfileBlock, { props: { block: profile } })
    expect(wrapper.find('.bd-plate-mascot').exists()).toBe(false)
    expect(wrapper.get('.bd-plate-photo').attributes('alt')).toBe('Alejandro')
  })
})

describe('StrapiTopicsBlock', () => {
  it('puts the two pillars first and labels the rest by number', async () => {
    const topics = block<StrapiTopics>('about.topics')
    const shuffled = { ...topics, topics: [...topics.topics!].reverse() }
    const wrapper = await mountSuspended(StrapiTopicsBlock, { props: { block: shuffled } })
    const cards = wrapper.findAll('.bd-topic')
    expect(cards.map(card => card.get('.bd-topic-title').text())).toEqual([
      'Privacy', 'Do it yourself', 'Artificial intelligence', 'Software development', 'Linux and open source',
    ])
    expect(cards.map(card => card.get('.bd-topic-label').text())).toEqual(['Pillar 01', 'Pillar 02', '03', '04', '05'])
    expect(cards[0]!.classes()).toContain('bd-topic-pillar')
    expect(cards[0]!.get('.bd-topic-bird').text()).toBe('Masked flowerpiercer · Diglossa cyanea')
    expect(wrapper.get('.bd-topic-footnote').text()).toContain('Hands-on tutorials')
  })
})

describe('StrapiProjectsBlock', () => {
  it('features one project with the diagram and lists the rest', async () => {
    const wrapper = await mountSuspended(StrapiProjectsBlock, { props: { block: block<StrapiProjects>('about.projects') } })
    expect(wrapper.attributes('id')).toBe('projects')
    const featured = wrapper.get('.bd-project-featured')
    expect(featured.get('h3').text()).toBe('BogDev on the fediverse')
    expect(featured.get('svg[role="img"]').attributes('aria-label')).toContain('Strapi publishes articles')
    const repo = featured.get('a[href="https://github.com/bogd3v/micelio-cms"]')
    expect(repo.attributes('target')).toBe('_blank')
    expect(repo.attributes('rel')).toBe('noopener noreferrer')
    const others = wrapper.findAll('.bd-project-grid .bd-project')
    expect(others).toHaveLength(2)
    expect(others[0]!.findAll('.bd-stack-chip').map(chip => chip.text())).toEqual(['Nuxt 4', 'Vue 3', 'i18n', 'Vitest', 'Playwright'])
    expect(others[1]!.findAll('.bd-swatch')).toHaveLength(5)
  })
})

describe('StrapiPrinciplesBlock', () => {
  it('numbers the principles', async () => {
    const wrapper = await mountSuspended(StrapiPrinciplesBlock, { props: { block: block<StrapiPrinciples>('about.principles') } })
    expect(wrapper.findAll('.bd-principle-number').map(number => number.text())).toEqual(['01', '02', '03', '04', '05'])
    expect(wrapper.get('.bd-principle-title').text()).toBe('Free software')
  })
})

function rendered(openSource: StrapiOpenSource): StrapiOpenSource {
  return renderBlocks([openSource], createMarkdownRenderer({ callout: tone => tone, cite: n => `${n}` }))[0] as StrapiOpenSource
}

describe('StrapiOpenSourceBlock', () => {
  it('renders inline links and opens the search from the guide', async () => {
    const wrapper = await mountSuspended(StrapiOpenSourceBlock, { props: { block: rendered(block<StrapiOpenSource>('about.open-source')) } })
    expect(wrapper.find('figure.bd-code').exists()).toBe(true)
    const items = wrapper.findAll('.bd-guide-list li')
    expect(items).toHaveLength(4)
    expect(items[1]!.get('a').attributes('href')).toBe('/blog')
    const listener = vi.fn()
    window.addEventListener('skip-to-search', listener)
    await items[0]!.get('a[href="#search"]').trigger('click')
    window.removeEventListener('skip-to-search', listener)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('does not render raw HTML from Strapi', async () => {
    const openSource = { ...block<StrapiOpenSource>('about.open-source'), guide: [{ id: 1, text: 'Hi <img src=x onerror=alert(1)> **there**' }] }
    const wrapper = await mountSuspended(StrapiOpenSourceBlock, { props: { block: rendered(openSource) } })
    const html = wrapper.get('.bd-guide-list li').html()
    expect(html).not.toContain('<img')
    expect(html).toContain('<strong>there</strong>')
  })
})

describe('StrapiContactBlock', () => {
  it('links the fediverse account and the social profiles with rel="me"', async () => {
    const wrapper = await mountSuspended(StrapiContactBlock, { props: { block: block<StrapiContact>('about.contact') } })
    expect(wrapper.get('h2').text()).toBe('Let\'s talk.')
    expect(wrapper.get('.bd-contact-fedi a').attributes('href')).toBe('/#fediverso')
    const rows = wrapper.get('nav[aria-label="Social"]').findAll('a')
    expect(rows.map(row => row.get('.bd-home-eyebrow').text())).toEqual(['LinkedIn', 'GitHub', 'Codeberg', 'Mastodon'])
    expect(rows.every(row => row.attributes('rel') === 'noopener noreferrer me')).toBe(true)
  })
})
