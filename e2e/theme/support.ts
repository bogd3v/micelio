import type { Locator, Page } from '@playwright/test'

export interface ThemePage {
  /** Snapshot and report name */
  name: string
  path: string
  /** Mermaid diagrams that must be drawn before the capture */
  diagrams?: number
}

// The article is one the mock serves without diagrams (the Mermaid ones have a broken block on purpose)
export const PAGES: ThemePage[] = [
  { name: 'home', path: '/' },
  { name: 'blog', path: '/blog' },
  { name: 'article', path: '/blog/understanding-vue-composables' },
  { name: 'about', path: '/about' },
  { name: 'specimen', path: '/_theme', diagrams: 2 },
]

// 1x1 PNG
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

/** Images come from a CDN the run does not rely on: a fixed pixel keeps layout and bytes stable. Any other external request is dropped. */
export async function isolateNetwork(page: Page): Promise<void> {
  await page.route(url => !['127.0.0.1', 'localhost'].includes(url.hostname), (route) => {
    if (route.request().resourceType() === 'image') return route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL })
    return route.abort()
  })
}

/** Navigates and waits until nothing moves: network idle, fonts, hydration and the Mermaid diagrams. */
export async function openPage(page: Page, { path, diagrams = 0 }: ThemePage): Promise<void> {
  await isolateNetwork(page)
  // Lazy images below the fold would load by scroll position: load them all before the capture
  await page.addInitScript(() => {
    new MutationObserver((records) => {
      for (const record of records) record.addedNodes.forEach(node => node instanceof HTMLImageElement && node.setAttribute('loading', 'eager'))
    }).observe(document, { childList: true, subtree: true })
  })
  await page.goto(path, { waitUntil: 'networkidle' })
  // Diagrams are drawn when they near the viewport (ADR 0006, section 6): bring each one in, as a reader scrolling would
  if (diagrams) {
    const blocks = page.locator('micelio-mermaid')
    for (let index = 0; index < await blocks.count(); index++) await blocks.nth(index).scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollTo(0, 0))
  }
  if (diagrams) await page.waitForFunction(count => document.querySelectorAll('.bd-mermaid-diagram svg').length >= count, diagrams)
  await page.evaluate(() => Promise.all([
    document.fonts.ready,
    ...Array.from(document.images, image => image.complete ? null : new Promise((resolve) => { image.onload = image.onerror = resolve })),
  ]))
}

/** What changes with the clock: dates and the footer year */
export function volatile(page: Page): Locator[] {
  return [page.locator('time'), page.locator('.bd-foot-legal > span:first-child')]
}
