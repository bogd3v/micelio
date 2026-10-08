import { describe, it, expect } from 'vitest'
import { headerLinks, landingLinks, sectionAnchors } from '../app/helpers/landing'
import { isBlogEnabled } from '../app/helpers/siteMode'
import { BLOG_ROUTES, initialRoutes, STATIC_INITIAL_ROUTES, staticFileRoutes } from '../app/helpers/staticBuild'
import type { PageSection } from '../app/interfaces/page'

const context = { newsletterOn: true, blogEnabled: true }
const resolve = { prefix: '', localize: (path: string): string => path }

function hero(primary?: string, secondary?: string): PageSection {
  return {
    __component: 'section.hero',
    variant: 'centered',
    title: 'Welcome',
    primaryLink: primary ? { label: 'Start', url: primary } : undefined,
    secondaryLink: secondary ? { label: 'More', url: secondary } : undefined,
  }
}

function feature(title?: string): PageSection {
  return { __component: 'section.feature-grid', variant: 'grid', title, items: [] }
}

describe('sectionAnchors', () => {
  it('derives a slug-safe id from the title of each section that has one', () => {
    const anchors = sectionAnchors([hero(), feature('What you need'), feature(), feature('¿Cómo funciona? 100%')], context)
    expect(anchors).toEqual([
      { index: 1, id: 'section-what-you-need', label: 'What you need' },
      { index: 3, id: 'section-como-funciona-100', label: '¿Cómo funciona? 100%' },
    ])
  })

  it('keeps ids unique and falls back to the position when the title has no letters', () => {
    const ids = sectionAnchors([feature('Pricing'), feature('Pricing'), feature('Pricing'), feature('???')], context).map(anchor => anchor.id)
    expect(ids).toEqual(['section-pricing', 'section-pricing-2', 'section-pricing-3', 'section-4'])
  })

  it('leaves out what renders nothing: the hero, rich text, a post list with no posts and a newsletter that is off', () => {
    const sections: PageSection[] = [
      hero(),
      { __component: 'section.rich-text', html: '<h2>About</h2>' },
      { __component: 'section.post-list', variant: 'cards', title: 'Latest', count: 3, posts: [] },
      { __component: 'section.newsletter', variant: 'card', title: 'Subscribe' },
    ]
    expect(sectionAnchors(sections, { ...context, newsletterOn: false })).toEqual([])
    expect(sectionAnchors(sections, context).map(anchor => anchor.label)).toEqual(['Subscribe'])
  })
})

describe('landingLinks', () => {
  it('lists the anchors, then the links of the hero and the call to action once each', () => {
    const sections: PageSection[] = [
      hero('/pricing', 'https://example.com'),
      feature('Features'),
      { __component: 'section.cta', variant: 'banner', title: 'Go', primaryLink: { label: 'Pricing', url: '/pricing' } },
    ]
    const links = landingLinks(sections, '/', context, resolve)
    expect(links.map(link => [link.label, link.to, link.anchor ?? false, link.action ?? false])).toEqual([
      ['Features', '/#section-features', true, false],
      ['Go', '/#section-go', true, false],
      ['Start', '/pricing', false, true],
      ['More', 'https://example.com', false, true],
    ])
  })

  it('prefixes the anchors with the home path of the locale', () => {
    expect(landingLinks([feature('Servicios')], '/es', context, { prefix: '/es', localize: path => `/es${path}` })[0]?.to).toBe('/es#section-servicios')
  })

  it('drops a link the section renderer rejects, and a link to the blog when the build has none', () => {
    const sections: PageSection[] = [hero('#top', 'javascript:alert(1)'), { __component: 'section.cta', variant: 'banner', title: 'Go', primaryLink: { label: 'Blog', url: '/blog/post' } }]
    expect(landingLinks(sections, '/', { ...context, blogEnabled: false }, resolve).filter(link => link.action)).toEqual([])
    expect(landingLinks(sections, '/', context, resolve).filter(link => link.action).map(link => link.to)).toEqual(['/blog/post'])
  })
})

describe('headerLinks', () => {
  const links = [
    ...Array.from({ length: 6 }, (_, index) => ({ id: `a${index}`, anchor: true })),
    ...Array.from({ length: 3 }, (_, index) => ({ id: `l${index}`, action: true })),
    { id: 'blog' },
  ]

  it('keeps the first anchors and the first links of the hero and the call to action, and what is neither', () => {
    expect(headerLinks(links).map(link => link.id)).toEqual(['a0', 'a1', 'a2', 'a3', 'l0', 'l1', 'blog'])
  })

  it('leaves the navigation of the other modes as it is', () => {
    const plain = [{ id: 'home' }, { id: 'blog' }, { id: 'about' }]
    expect(headerLinks(plain)).toEqual(plain)
  })
})

describe('the blog switch', () => {
  it('is off only when the build says so', () => {
    expect(isBlogEnabled(false)).toBe(false)
    expect([true, undefined, null, '', 'false', 0].map(isBlogEnabled)).toEqual([true, true, true, true, true, true])
  })

  it('removes the blog routes and the feeds from a build with no blog', () => {
    expect(initialRoutes(true)).toEqual([...STATIC_INITIAL_ROUTES])
    expect(initialRoutes(false)).toEqual(['/', '/es'])
    expect(staticFileRoutes(false)).toEqual(['/sitemap.xml', '/robots.txt'])
    expect(staticFileRoutes()).toContain('/feed.xml')
  })

  it('matches the blog, its filters and the feeds in every locale and nothing else', () => {
    for (const route of ['/blog', '/es/blog', '/blog/a-post', '/blog/category/linux', '/es/blog/tag/vue/page/2', '/feed.xml', '/es/feed.xml', '/feed/linux.xml', '/es/feed/linux.xml']) expect(BLOG_ROUTES.test(route), route).toBe(true)
    for (const route of ['/', '/es', '/blogging', '/feedback', '/privacy', '/showcase', '/es/muestra']) expect(BLOG_ROUTES.test(route), route).toBe(false)
  })
})
