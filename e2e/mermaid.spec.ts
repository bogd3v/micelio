import { test, expect } from '@playwright/test'
import type { Page, Response } from '@playwright/test'

const ARTICLE = '/blog/linux-server-hardening-guide'

async function mermaidScriptUrl(response: Response): Promise<string> {
  try {
    const body = await response.text()
    return body.includes('mermaidAPI') ? response.url() : ''
  } catch {
    return ''
  }
}

/** Scripts that hold Mermaid's API: a chunk of /_islands/ in the build and in dev */
function trackMermaid(page: Page): Promise<string>[] {
  const scripts: Promise<string>[] = []
  page.on('response', (response) => {
    if (response.request().resourceType() !== 'script') return
    scripts.push(mermaidScriptUrl(response))
  })
  return scripts
}

async function mermaidScripts(scripts: Promise<string>[]): Promise<string[]> {
  return (await Promise.all(scripts)).filter(Boolean)
}

/** The diagrams start below the fold: they are drawn once scrolled near, so bring each block into view. */
async function drawDiagrams(page: Page): Promise<void> {
  await page.goto(ARTICLE, { waitUntil: 'networkidle' })
  const blocks = page.locator('micelio-mermaid')
  for (let index = 0; index < await blocks.count(); index++) await blocks.nth(index).scrollIntoViewIfNeeded()
  await expect(page.locator('.bd-mermaid-diagram svg')).toHaveCount(2)
}

test('renders flowcharts and sequence diagrams as labelled images', async ({ page }) => {
  await drawDiagrams(page)
  const diagrams = page.locator('.bd-mermaid-diagram')
  await expect(diagrams).toHaveCount(2)
  await expect(page.getByRole('img', { name: 'SSH login flow' }).locator('svg')).toBeVisible()
  await expect(diagrams.nth(1)).toHaveAttribute('aria-label', 'Diagram')
  await expect(diagrams.nth(1).locator('svg')).toContainText('Offer public key')
  await expect(page.locator('.bd-mermaid-ready figure.bd-code')).toHaveCount(2)
  await expect(page.locator('.bd-mermaid-ready figure.bd-code').first()).toBeHidden()
})

test('keeps the source visible when a diagram cannot be parsed', async ({ page }) => {
  await drawDiagrams(page)
  const broken = page.locator('micelio-mermaid:not(.bd-mermaid-ready)')
  await expect(broken).toHaveCount(1)
  await broken.scrollIntoViewIfNeeded()
  await expect(broken.locator('.bd-code-lang')).toHaveText('mermaid')
  await expect(broken.locator('code')).toBeVisible()
  await expect(broken.locator('.bd-mermaid-diagram')).toHaveCount(0)
})

test('does not run markup from the diagram source', async ({ page }) => {
  await drawDiagrams(page)
  const handlers = await page.locator('.bd-mermaid-diagram').evaluateAll(diagrams =>
    diagrams.flatMap(diagram => Array.from(diagram.querySelectorAll('*')))
      .flatMap(element => element.getAttributeNames().filter(name => name.startsWith('on'))),
  )
  expect(handlers).toEqual([])
  await expect(page.locator('.bd-mermaid-diagram script')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
})

test('redraws the diagrams with the colors of the new theme', async ({ page }) => {
  await drawDiagrams(page)
  const node = page.getByRole('img', { name: 'SSH login flow' }).locator('.node rect').first()
  await expect(node).toBeVisible()
  const dayFill = await node.evaluate(element => getComputedStyle(element).fill)
  await page.getByRole('group', { name: 'Color theme' }).getByRole('button', { name: 'Night' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'noche')
  await expect.poll(async () => page.getByRole('img', { name: 'SSH login flow' }).locator('.node rect').first().evaluate(element => getComputedStyle(element).fill)).not.toBe(dayFill)
})

test('hydrates without a mismatch', async ({ page }) => {
  const warnings: string[] = []
  page.on('console', (message) => {
    if (/hydrat/i.test(message.text())) warnings.push(message.text())
  })
  await drawDiagrams(page)
  expect(warnings).toEqual([])
})

test('draws the diagrams with reduced motion too', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await drawDiagrams(page)
})

test('downloads Mermaid only on articles with diagrams, and only near the block', async ({ page }) => {
  const scripts = trackMermaid(page)
  await page.goto('/blog/understanding-vue-composables', { waitUntil: 'networkidle' })
  await expect(page.locator('script[id^="micelio-island-"]')).toHaveCount(0)
  expect(await mermaidScripts(scripts)).toEqual([])

  await page.goto(ARTICLE, { waitUntil: 'networkidle' })
  // The island's entry is not in the HTML and the first diagram is below the fold: nothing yet
  await expect(page.locator('micelio-mermaid').first()).not.toBeInViewport()
  expect(await page.locator('script[src*="/_islands/mermaid-"]').count()).toBe(0)
  expect(await mermaidScripts(scripts)).toEqual([])

  await page.locator('micelio-mermaid').first().scrollIntoViewIfNeeded()
  await expect(page.locator('.bd-mermaid-diagram svg').first()).toBeVisible()
  expect((await mermaidScripts(scripts)).length).toBeGreaterThan(0)
})

test('draws a diagram on a page reached by navigating, without a reload', async ({ page }) => {
  await page.goto('/blog', { waitUntil: 'networkidle' })
  await page.getByRole('link', { name: 'Linux Server Hardening Guide' }).first().click()
  await expect(page).toHaveURL(new RegExp(`${ARTICLE}$`))
  const blocks = page.locator('micelio-mermaid')
  await expect(blocks).toHaveCount(3)
  for (let index = 0; index < 3; index++) await blocks.nth(index).scrollIntoViewIfNeeded()
  await expect(page.locator('.bd-mermaid-diagram svg')).toHaveCount(2)
})
