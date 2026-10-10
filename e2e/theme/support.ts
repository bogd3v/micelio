import type { Locator, Page } from '@playwright/test'
import { HYDRATED_FLAG } from '../../app/islands/lib/hydrated'

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
  // Network idle is not hydration: on a slow CPU Vue hydrates late and replaces nodes, and a capture in between finds its element detached
  await page.waitForFunction(flag => !document.getElementById('__NUXT_DATA__') || (window as unknown as Record<string, unknown>)[flag] === true, HYDRATED_FLAG)
  // Diagrams are drawn when they near the viewport (ADR 0006, section 6): bring each one in, as a reader scrolling would
  if (diagrams) {
    const blocks = page.locator('micelio-mermaid')
    for (let index = 0; index < await blocks.count(); index++) await blocks.nth(index).scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollTo(0, 0))
  }
  if (diagrams) await page.waitForFunction(count => document.querySelectorAll('.myc-mermaid-diagram svg').length >= count, diagrams)
  // `complete` is true before a `decoding="async"` image is decoded and painted: wait for the decode too, or it appears between two captures
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(Array.from(document.images, async (image) => {
      if (!image.complete) {
        await new Promise((resolve) => {
          image.addEventListener('load', resolve, { once: true })
          image.addEventListener('error', resolve, { once: true })
        })
      }
      try {
        await image.decode()
      } catch {
        // A broken image has nothing to decode; the capture shows it as it is
      }
    }))
  })
}

/** What changes with the clock: dates and the footer year */
export function volatile(page: Page): Locator[] {
  return [page.locator('time'), page.locator('.myc-foot-legal > span:first-child')]
}
