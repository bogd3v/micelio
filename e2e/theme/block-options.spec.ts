import { test, expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { openPage } from './support'

// The presentation options of the blocks (#731), in every mode and viewport of the active theme: the core's rules for each value,
// which the theme's own CSS must leave alone unless it sets the same property (docs/themes/reference/hooks.md, "Block options")
const PAGE = { name: 'block-options', path: '/block-options' }
// The Spanish article of the mock sets an option on each of its quote, image, slider and two playgrounds (e2e/mock-strapi.mjs)
const ARTICLE = { name: 'article-options', path: '/es/blog/guia-vue-composables' }

function section(page: Page, title: string): Locator {
  return page.locator('[data-section]', { has: page.getByRole('heading', { name: title }) })
}

/** The distinct left edges of the items of a section: its visible columns. */
async function columnsOf(root: Locator): Promise<number> {
  return root.locator('.myc-section-item').evaluateAll(items => new Set(items.map(item => Math.round(item.getBoundingClientRect().left))).size)
}

test.describe('sections', () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page, PAGE)
  })

  test('columns: 2 renders two columns on a wide screen and one at phone width', async ({ page }, testInfo) => {
    const root = section(page, 'Two columns')
    await expect(root).toHaveAttribute('data-columns', '2')
    expect(await columnsOf(root)).toBe(testInfo.project.metadata.viewport === 'mobile' ? 1 : 2)
  })

  test('columns: 4 renders four columns on a wide screen and one at phone width', async ({ page }, testInfo) => {
    expect(await columnsOf(section(page, 'Four columns, compact'))).toBe(testInfo.project.metadata.viewport === 'mobile' ? 1 : 4)
  })

  test('a section with no options writes no option attribute and keeps its own grid', async ({ page }) => {
    const root = section(page, 'No options')
    const names = await root.evaluate(element => element.getAttributeNames().filter(name => /^data-(layout|width|columns|density|align|tone|ratio|height)$/.test(name)))
    expect(names).toEqual([])
    expect(await columnsOf(root)).toBeGreaterThan(0)
  })

  test('layout: split puts the text and the media side by side on a wide screen, whatever the variant says', async ({ page }, testInfo) => {
    const root = section(page, 'Split hero')
    await expect(root).toHaveAttribute('data-variant', 'centered')
    const [head, media] = await Promise.all([root.locator('.myc-section-head').boundingBox(), root.locator('.myc-section-media').boundingBox()])
    expect(head).not.toBeNull()
    expect(media).not.toBeNull()
    if (testInfo.project.metadata.viewport === 'mobile') expect(media!.y).toBeGreaterThan(head!.y + head!.height - 1)
    else expect(media!.x).toBeGreaterThan(head!.x + head!.width - 1)
  })

  test('density: compact tightens the gap between the items', async ({ page }) => {
    const gap = (root: Locator): Promise<number> => root.locator('.myc-section-items').evaluate(items => Number.parseFloat(getComputedStyle(items).rowGap))
    const compact = await gap(section(page, 'Four columns, compact'))
    const comfortable = await gap(section(page, 'Two columns'))
    expect(compact).toBeGreaterThan(0)
    expect(compact).toBeLessThan(comfortable)
  })

  test('tone sets the surface from the roles of the mode', async ({ page }) => {
    const background = (root: Locator): Promise<string> => root.evaluate(element => getComputedStyle(element).backgroundColor)
    const role = (name: string): Promise<string> => page.evaluate((property) => {
      const probe = document.createElement('div')
      probe.style.background = `var(${property})`
      document.body.append(probe)
      const color = getComputedStyle(probe).backgroundColor
      probe.remove()
      return color
    }, name)
    expect(await background(section(page, 'Accent and centered'))).toBe(await role('--accent-soft'))
    expect(await background(section(page, 'Raised card'))).toBe(await role('--surface-raised'))
  })

  test('align: center centers the text of the section', async ({ page }) => {
    await expect(section(page, 'Accent and centered').locator('.myc-section-inner')).toHaveCSS('text-align', 'center')
  })

  test('ratio: 1:1 gives the media a square box', async ({ page }) => {
    const box = await section(page, 'Square media').locator('.myc-section-media').first().boundingBox()
    expect(box).not.toBeNull()
    expect(Math.abs(box!.width - box!.height)).toBeLessThan(2)
  })

  test('no option makes the page scroll sideways', async ({ page }) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

const css = (locator: Locator, property: string): Promise<string> => locator.evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property)
const boxOf = async (locator: Locator): Promise<{ width: number, height: number }> => {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  return { width: Math.round(box!.width), height: Math.round(box!.height) }
}

test.describe('stored defaults', () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page, PAGE)
  })

  // Strapi fills the default in on a new entry, so a block that stores it must look as the block with no option
  test('a hero with layout centered and height m looks like a hero with none', async ({ page }) => {
    const [stored, plain] = [section(page, 'Stored hero'), section(page, 'Plain hero')]
    await expect(stored).toHaveAttribute('data-layout', 'centered')
    await expect(stored).toHaveAttribute('data-height', 'm')
    for (const property of ['text-align', 'min-height', 'display', 'padding-top']) {
      expect(await css(stored.locator('.myc-section-inner'), property), property).toBe(await css(plain.locator('.myc-section-inner'), property))
      expect(await css(stored, property), property).toBe(await css(plain, property))
    }
    expect(await boxOf(stored)).toEqual(await boxOf(plain))
  })

  test('a gallery with width prose looks like a gallery with none', async ({ page }) => {
    await expect(section(page, 'Stored gallery')).toHaveAttribute('data-width', 'prose')
    expect(await boxOf(section(page, 'Stored gallery').locator('.myc-section-inner'))).toEqual(await boxOf(section(page, 'Plain gallery').locator('.myc-section-inner')))
  })

  test('a grid with columns 3 keeps its own columns', async ({ page }) => {
    await expect(section(page, 'Stored grid')).toHaveAttribute('data-columns', '3')
    expect(await css(section(page, 'Stored grid').locator('.myc-section-items'), 'grid-template-columns')).toBe(await css(section(page, 'Plain grid').locator('.myc-section-items'), 'grid-template-columns'))
  })

  test('a showcase with ratio 16:9 keeps the shape of its file', async ({ page }) => {
    await expect(section(page, 'Stored showcase')).toHaveAttribute('data-ratio', '16:9')
    expect(await boxOf(section(page, 'Stored showcase').locator('.myc-section-media'))).toEqual(await boxOf(section(page, 'Plain showcase').locator('.myc-section-media')))
  })
})

test.describe('values the sections render', () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page, PAGE)
  })

  // The core gives a hero no look for its height yet (follow-up of #731): the attribute is written and the hero keeps its own look
  test('height: l on a hero is written and the hero keeps its own height', async ({ page }) => {
    await expect(section(page, 'Tall hero')).toHaveAttribute('data-height', 'l')
    expect(await boxOf(section(page, 'Tall hero'))).toEqual(await boxOf(section(page, 'Plain hero')))
  })

  test('width: full gives the gallery more room than the default', async ({ page }, testInfo) => {
    const padding = async (title: string): Promise<number> => Number.parseFloat(await css(section(page, title).locator('.myc-section-inner'), 'padding-left'))
    expect(await padding('Full gallery')).toBeLessThanOrEqual(await padding('Plain gallery'))
    if (testInfo.project.metadata.viewport !== 'mobile') expect(await padding('Full gallery')).toBeLessThan(await padding('Plain gallery'))
  })

  test('columns: 6 on a logo cloud spreads the logos over the section', async ({ page }, testInfo) => {
    const root = section(page, 'Six logos')
    const items = root.locator('.myc-section-logo-track > .myc-section-items')
    const [list, inner] = [await boxOf(items), await boxOf(root.locator('.myc-section-inner'))]
    expect(list.width).toBeGreaterThan(inner.width * 0.7)
    const lefts = await root.locator('.myc-section-item').evaluateAll(nodes => new Set(nodes.map(node => Math.round(node.getBoundingClientRect().left))).size)
    expect(lefts).toBe(testInfo.project.metadata.viewport === 'mobile' ? 1 : 6)
  })

  test('the page keeps no axe violation with every option set', async ({ page }) => {
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
    expect(results.violations.map(violation => `${violation.id}: ${violation.nodes.map(node => node.target.join(' ')).join(' | ')}`)).toEqual([])
  })
})

test.describe('article blocks', () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page, ARTICLE)
  })

  test('align: center puts the bar of a quote on top and takes the left one away', async ({ page }) => {
    const quote = page.locator('blockquote.myc-quote[data-align="center"]')
    await expect(quote).toHaveCount(1)
    expect(await css(quote, 'padding-left')).toBe('0px')
    expect(await css(quote, 'border-left-width')).toBe('0px')
    expect(await css(quote, 'border-top-width')).toBe('4px')
    expect(await css(quote, 'text-align')).toBe('center')
  })

  // The mock serves a 16:9 file for this image: with no ratio its box is 16:9, so a ratio that does nothing is seen
  const media = (page: Page, caption: string): Locator => page.locator('.myc-fig', { hasText: caption }).locator('.myc-fig-media')

  test('ratio: an image with no option keeps the shape of its file, 1:1 and 4:3 cut it, auto keeps it', async ({ page }) => {
    const plain = await boxOf(media(page, 'Una imagen sin opciones.'))
    expect(plain.width / plain.height).toBeCloseTo(16 / 9, 1)
    const square = await boxOf(page.locator('.myc-fig[data-ratio="1:1"]:not(.myc-slider) .myc-fig-media'))
    expect(Math.abs(square.width - square.height)).toBeLessThanOrEqual(1)
    // The image fills the cut box (an image left at the shape of its file leaves a band under it)
    const squareImage = await boxOf(page.locator('.myc-fig[data-ratio="1:1"]:not(.myc-slider) .myc-fig-media img'))
    expect(squareImage.height).toBeGreaterThanOrEqual(square.height - 3)
    const cut = await boxOf(media(page, 'Una imagen en 4:3.'))
    expect(cut.width / cut.height).toBeCloseTo(4 / 3, 1)
    expect((await boxOf(media(page, 'Una imagen en 4:3.').locator('img'))).height).toBeGreaterThanOrEqual(cut.height - 3)
    const auto = media(page, 'Una imagen con la forma de su archivo.')
    expect(await css(auto, 'aspect-ratio')).toBe('auto')
    expect(await boxOf(auto)).toEqual(plain)
  })

  test('the defaults of an image and a quote, stored, look like the ones with no option', async ({ page }) => {
    const plainImage = page.locator('.myc-fig:not([data-width]):not([data-ratio]):not(.myc-slider)', { hasText: 'Una imagen sin opciones.' })
    const savedImage = page.locator('.myc-fig[data-width="prose"][data-ratio="16:9"]')
    await expect(savedImage).toHaveCount(1)
    expect(await boxOf(savedImage.locator('.myc-fig-media'))).toEqual(await boxOf(plainImage.locator('.myc-fig-media')))
    expect((await savedImage.boundingBox())!.x).toBe((await plainImage.boundingBox())!.x)
    const plainQuote = page.locator('blockquote.myc-quote:not([data-width]):not([data-align])')
    const savedQuote = page.locator('blockquote.myc-quote[data-width="prose"][data-align="start"]')
    await expect(savedQuote).toHaveCount(1)
    expect(await boxOf(savedQuote)).toEqual(await boxOf(plainQuote))
    for (const property of ['padding-left', 'border-left-width', 'border-top-width', 'text-align']) expect(await css(savedQuote, property), property).toBe(await css(plainQuote, property))
  })

  test('the ratio of a slider sets the shape of its frame: 16:9 and auto are its own, 4:3 and 1:1 replace it', async ({ page }) => {
    const frame = async (ratio: string | null): Promise<number> => {
      const slider = page.locator(ratio ? `.myc-slider[data-ratio="${ratio}"]` : '.myc-slider:not([data-ratio])').first()
      const box = await boxOf(slider.locator('.myc-slider-frame'))
      return box.width / box.height
    }
    const own = await frame(null)
    expect(await frame('16:9')).toBeCloseTo(own, 2)
    expect(await frame('4:3')).toBeCloseTo(4 / 3, 1)
    expect(await frame('1:1')).toBeCloseTo(1, 1)
    expect(await frame('auto')).toBeCloseTo(own, 2)
  })

  test('height on a playground: l is 40rem, full one viewport, s and m are as tall as the code', async ({ page }) => {
    const viewport = page.viewportSize()!.height
    const height = async (value: string): Promise<number> => (await boxOf(page.locator(`.myc-playground[data-height="${value}"]`).first())).height
    const plain = (await boxOf(page.locator('.myc-playground:not([data-height])').first())).height
    expect(await height('l')).toBeGreaterThanOrEqual(640)
    expect(await height('full')).toBeGreaterThanOrEqual(viewport)
    expect(await css(page.locator('.myc-playground[data-height="full"]'), 'min-height')).toBe(`${viewport}px`)
    expect(await css(page.locator('.myc-playground[data-height="s"]'), 'min-height')).toBe(await css(page.locator('.myc-playground:not([data-height])').first(), 'min-height'))
    expect(await height('s')).toBeLessThanOrEqual(plain + 80)
  })

  test('ratio: 16:9 on a slider keeps the slider\'s own shape', async ({ page }) => {
    const slider = page.locator('.myc-slider[data-ratio="16:9"] .myc-slider-frame')
    await expect(slider).toHaveCount(1)
    const { width, height } = await boxOf(slider)
    expect(width / height).toBeCloseTo(16 / 10, 1)
  })

  test('height: l on a playground is 40rem and m is 0', async ({ page }) => {
    expect(await css(page.locator('.myc-playground[data-height="l"]'), 'min-height')).toBe('640px')
    expect(await css(page.locator('.myc-playground[data-height="m"]'), 'min-height')).toBe(await css(page.locator('.myc-playground:not([data-height])').first(), 'min-height'))
  })

  test('width: wide takes a quote and an image out of the text column on a wide screen', async ({ page }, testInfo) => {
    const prose = await boxOf(page.locator('.myc-prose').first())
    for (const wide of ['.myc-quote[data-width="wide"]', '.myc-fig[data-width="wide"]']) {
      const box = await boxOf(page.locator(wide))
      if (testInfo.project.metadata.viewport === 'mobile') expect(box.width).toBeLessThanOrEqual(prose.width)
      else expect(box.width, wide).toBeGreaterThan(prose.width)
    }
  })
})
