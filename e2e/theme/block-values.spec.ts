import { test, expect } from '@playwright/test'
import type { Locator, Page, TestInfo } from '@playwright/test'
import { blockValueCases, blockValueKey } from '../fixtures/pages.mjs'
import { openPage } from './support'

// Every value of every presentation option on every block that exposes it (#731), as a table: the section of the mock page
// /block-options whose title is the key of the case. The default value is checked against a plain twin (the plugin stores it on a new
// entry, so it must look like the block with no option), the other values by the geometry or the computed style they promise.
const PAGE = { name: 'block-options', path: '/block-options' }

interface Ctx {
  page: Page
  mobile: boolean
  /** The section of a case. */
  at: (block: string, options?: Record<string, string>) => Locator
  /** The plain twin of a block. */
  plain: (block: string) => Locator
}

type Check = (ctx: Ctx, root: Locator, plain: Locator) => Promise<void>

interface Rect { x: number, y: number, width: number, height: number, right: number, bottom: number }

async function rect(locator: Locator): Promise<Rect> {
  const box = await locator.first().boundingBox()
  expect(box, 'the element has a box').not.toBeNull()
  const { x, y, width, height } = box!
  return { x, y, width, height, right: x + width, bottom: y + height }
}

const css = (locator: Locator, property: string): Promise<string> => locator.first().evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property)
const px = async (locator: Locator, property: string): Promise<number> => Number.parseFloat(await css(locator, property))

/** The distinct left edges of the items of a section: its visible columns. */
const columnsOf = (root: Locator): Promise<number> =>
  root.locator('.myc-section-item').evaluateAll(items => new Set(items.map(item => Math.round(item.getBoundingClientRect().left))).size)

async function role(page: Page, property: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('div')
    probe.style.background = `var(${name})`
    document.body.append(probe)
    const color = getComputedStyle(probe).backgroundColor
    probe.remove()
    return color
  }, property)
}

const inner = (root: Locator): Locator => root.locator('.myc-section-inner')
const head = (root: Locator): Locator => root.locator('.myc-section-head')

// A theme may paint a hero or a banner itself (a gradient in its own layer): its background then wins over `tone`, as the guide says,
// and the section keeps it. Where the plain twin paints none, the tone must set the role.
function tone(role_: string): Check {
  return async ({ page }, root, plain) => {
    if (await css(plain, 'background-image') !== 'none') {
      expect(await css(root, 'background-image'), 'the theme keeps its own background').not.toBe('none')
      return
    }
    expect(await css(root, 'background-color')).toBe(await role(page, role_))
  }
}

function columns(count: number): Check {
  return async ({ mobile }, root) => {
    expect(await columnsOf(root)).toBe(mobile ? 1 : count)
    // The list takes the section, not the width of its content (a logo cloud's list sits in a flex row)
    const [list, box] = [await rect(root.locator('.myc-section-items')), await rect(inner(root))]
    expect(list.width).toBeGreaterThan((box.width - 2 * await px(inner(root), 'padding-left')) * 0.9)
  }
}

const newsletterCentered: Check = async (_ctx, root, plain) => {
  expect(await css(inner(root), 'text-align')).toBe('center')
  const [form, twin, box] = [await rect(root.locator('.myc-news')), await rect(plain.locator('.myc-news')), await rect(inner(root))]
  expect(form.width).toBeGreaterThan(100)
  expect(Math.round(form.width)).toBe(Math.round(twin.width))
  expect(Math.abs((form.x + form.width / 2) - (box.x + box.width / 2))).toBeLessThanOrEqual(2)
}

const compact: Check = async (_ctx, root, plain) => {
  expect(await px(root, 'padding-top')).toBeLessThan(await px(plain, 'padding-top'))
}

/** The ratio of the section's media box, or of the file when `auto`. */
function ratio(width: number, height: number): Check {
  return async (_ctx, root) => {
    const box = await rect(root.locator('.myc-section-media'))
    expect(box.width / box.height).toBeCloseTo(width / height, 1)
  }
}

const sameBox: Check = async (_ctx, root, plain) => {
  const [a, b] = [await rect(inner(root)), await rect(inner(plain))]
  expect([a.x, a.width]).toEqual([b.x, b.width])
}

function splitMedia(): Check {
  return async ({ mobile }, root) => {
    const [h, media] = [await rect(head(root)), await rect(root.locator('.myc-section-media'))]
    if (mobile) expect(media.y).toBeGreaterThanOrEqual(h.bottom - 1)
    else expect(media.x).toBeGreaterThanOrEqual(h.right - 1)
    expect(media.width).toBeGreaterThan(100)
  }
}

/** Values the core gives no look (follow-up of #731): the section writes the attribute and renders its own look; the loop below asserts the attribute. */
const ATTRIBUTE_ONLY = new Set([
  'hero-split layout=stacked', 'hero-centered layout=stacked', 'testimonials layout=stacked', 'cta-card layout=stacked',
  'hero-split height=s', 'hero-split height=l', 'hero-split height=full',
  'scene-inline height=s', 'scene-inline height=l', 'scene-inline height=full',
  'scene-background height=s', 'scene-background height=l', 'scene-background height=full',
])

const CHECKS: Record<string, Check> = {
  'hero-split layout=split': splitMedia(),
  'hero-split tone=raised': tone('--surface-raised'),
  'hero-split tone=accent': tone('--accent-soft'),
  'hero-centered layout=split': splitMedia(),
  'feature-grid columns=2': columns(2),
  'feature-grid columns=4': columns(4),
  'feature-grid density=compact': compact,
  'showcase ratio=4:3': ratio(4, 3),
  'showcase ratio=1:1': ratio(1, 1),
  // The box takes the shape of its file: no ratio of its own, and no crop (the mock's file is a 1x1 PNG, so the file's shape is its image box)
  'showcase ratio=auto': async (_ctx, root) => {
    expect(await css(root.locator('.myc-section-media'), 'aspect-ratio')).toBe('auto')
    const [box, image] = [await rect(root.locator('.myc-section-media')), await rect(root.locator('.myc-section-media img'))]
    expect(box.width / box.height).toBeCloseTo(image.width / image.height, 1)
  },
  'stats columns=2': columns(2),
  'stats columns=4': columns(4),
  'stats align=center': async (_ctx, root) => {
    expect(await css(inner(root), 'text-align')).toBe('center')
  },
  'stats tone=raised': tone('--surface-raised'),
  'stats tone=accent': tone('--accent-soft'),
  'logo-cloud columns=2': columns(2),
  'logo-cloud columns=4': columns(4),
  'logo-cloud columns=6': columns(6),
  'logo-cloud density=compact': compact,
  'testimonials layout=split': async ({ mobile }, root) => {
    const [h, list] = [await rect(head(root)), await rect(root.locator('.myc-section-items'))]
    if (mobile) expect(list.y).toBeGreaterThanOrEqual(h.bottom - 1)
    else expect(list.x).toBeGreaterThanOrEqual(h.right - 1)
  },
  'testimonials density=compact': compact,
  'pricing columns=2': columns(2),
  'pricing columns=4': columns(4),
  'faq density=compact': compact,
  'cta-card layout=split': async ({ mobile }, root) => {
    const [h, actions] = [await rect(head(root)), await rect(root.locator('.myc-section-actions'))]
    if (mobile) expect(actions.y).toBeGreaterThanOrEqual(h.bottom - 1)
    else expect(actions.x).toBeGreaterThanOrEqual(h.right - 1)
  },
  'cta-card align=center': async (_ctx, root) => {
    expect(await css(inner(root), 'text-align')).toBe('center')
    expect(await css(root.locator('.myc-section-actions'), 'justify-content')).toBe('center')
  },
  'cta-card tone=raised': tone('--surface-raised'),
  'cta-card tone=accent': tone('--accent-soft'),
  'cta-banner align=center': async (_ctx, root) => {
    expect(await css(inner(root), 'text-align')).toBe('center')
  },
  'cta-banner tone=raised': tone('--surface-raised'),
  'cta-banner tone=accent': tone('--accent-soft'),
  'post-list density=compact': compact,
  // The form is a container (it has no width of its own): it must keep the width of its plain twin and sit in the middle
  'newsletter align=center': newsletterCentered,
  'newsletter-inline align=center': newsletterCentered,
  'newsletter tone=raised': tone('--surface-raised'),
  'newsletter tone=accent': tone('--accent-soft'),
  // On a section `wide` is the container the default already is, so it must look like the default
  'rich-text width=wide': sameBox,
  'rich-text width=full': async ({ mobile }, root, plain) => {
    const [a, b] = [await rect(root.locator('.myc-section-text')), await rect(plain.locator('.myc-section-text'))]
    if (mobile) expect(a.x).toBeLessThanOrEqual(b.x)
    else expect(a.x).toBeLessThan(b.x)
  },
  'gallery width=wide': sameBox,
  'gallery width=full': async ({ mobile }, root, plain) => {
    const [a, b] = [await px(inner(root), 'padding-left'), await px(inner(plain), 'padding-left')]
    if (mobile) expect(a).toBeLessThanOrEqual(b)
    else expect(a).toBeLessThan(b)
  },
  'gallery density=compact': compact,
}

/** Every box and the style that places it, the text left out: two sections with the same look give the same list. */
function snapshot(root: Locator): Promise<unknown[]> {
  return root.evaluate((element) => {
    const top = element.getBoundingClientRect().top
    return [element, ...element.querySelectorAll('*')].map((node) => {
      const box = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      const name = node.tagName + (typeof node.className === 'string' ? `.${node.className}` : '')
      // The width of the head follows the length of its title, which is the one thing a twin does not share
      const text = node.closest('.myc-section-head') ? 0 : 1
      return [name, Math.round(box.x), Math.round(box.y - top), Math.round(box.width) * text, Math.round(box.height), style.textAlign, style.display, text ? style.gridTemplateColumns : '',
        style.minHeight, style.paddingTop, style.paddingLeft, style.backgroundColor, style.backgroundImage, style.justifyContent]
    })
  })
}

// The cases come from the fixture (plain JavaScript): [block, options, stored defaults?]
const ALL = blockValueCases as unknown as ReadonlyArray<[string, Record<string, string>, boolean?]>
const BLOCKS = [...new Set(ALL.map(([block]) => block))]
const CASES = ALL.filter(([, options, saved]) => !saved && Object.keys(options).length > 0)
const SAVED = ALL.filter(([, , saved]) => saved)

function context(page: Page, testInfo: TestInfo): Ctx {
  const find = (key: string): Locator => page.locator('[data-section]', { has: page.getByRole('heading', { name: key, exact: true }) })
  return {
    page,
    mobile: testInfo.project.metadata.viewport === 'mobile',
    at: (block, options = {}) => find(blockValueKey(block, options)),
    plain: block => find(blockValueKey(block, {})),
  }
}

test.describe('every value of every option, on every block that exposes it', () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page, PAGE)
  })

  test('the page has a section for each case and a twin for each block', async ({ page }, testInfo) => {
    const ctx = context(page, testInfo)
    for (const block of BLOCKS) await expect(ctx.plain(block), `${block} plain`).toHaveCount(1)
    for (const [block, options] of CASES) await expect(ctx.at(block, options), blockValueKey(block, options)).toHaveCount(1)
  })

  test('the table has a check for each case', () => {
    const keys = CASES.map(([block, options]) => blockValueKey(block, options))
    expect(keys.filter(key => !(key in CHECKS) && !ATTRIBUTE_ONLY.has(key))).toEqual([])
    expect(Object.keys(CHECKS).filter(key => !keys.includes(key))).toEqual([])
    expect([...ATTRIBUTE_ONLY].filter(key => !keys.includes(key))).toEqual([])
  })

  for (const [block, options] of CASES) {
    const key = blockValueKey(block, options)
    test(`${key}`, async ({ page }, testInfo) => {
      const ctx = context(page, testInfo)
      const root = ctx.at(block, options)
      for (const [name, value] of Object.entries(options)) await expect(root).toHaveAttribute(`data-${name}`, value)
      if (ATTRIBUTE_ONLY.has(key)) return
      await CHECKS[key]!(ctx, root, ctx.plain(block))
    })
  }

  for (const [block, options] of SAVED) {
    test(`${block} with ${Object.entries(options).map(([name, value]) => `${name}=${value}`).join(' ')} stored looks like ${block} with none`, async ({ page }, testInfo) => {
      const ctx = context(page, testInfo)
      const saved = page.locator('[data-section]', { has: page.getByRole('heading', { name: `${block} saved`, exact: true }) })
      for (const [name, value] of Object.entries(options)) await expect(saved).toHaveAttribute(`data-${name}`, value)
      expect(await snapshot(saved)).toEqual(await snapshot(ctx.plain(block)))
    })
  }
})
