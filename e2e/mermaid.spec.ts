import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const ARTICLE = '/blog/linux-server-hardening-guide'

/** Scripts that hold Mermaid's API: deps/mermaid.js in dev, a hashed chunk in the build */
function trackMermaid(page: Page): Promise<string>[] {
  const scripts: Promise<string>[] = []
  page.on('response', (response) => {
    if (response.request().resourceType() !== 'script') return
    scripts.push(response.text().then(body => body.includes('mermaidAPI') ? response.url() : '', () => ''))
  })
  return scripts
}

async function mermaidScripts(scripts: Promise<string>[]): Promise<string[]> {
  return (await Promise.all(scripts)).filter(Boolean)
}

test('renders flowcharts and sequence diagrams as labelled images', async ({ page }) => {
  await page.goto(ARTICLE, { waitUntil: 'networkidle' })
  const diagrams = page.locator('.bd-mermaid-diagram')
  await expect(diagrams).toHaveCount(2)
  await expect(page.getByRole('img', { name: 'SSH login flow' }).locator('svg')).toBeVisible()
  await expect(diagrams.nth(1)).toHaveAttribute('aria-label', 'Diagram')
  await expect(diagrams.nth(1).locator('svg')).toContainText('Offer public key')
  await expect(page.locator('.bd-mermaid-ready figure.bd-code')).toHaveCount(2)
  await expect(page.locator('.bd-mermaid-ready figure.bd-code').first()).toBeHidden()
})

test('keeps the source visible when a diagram cannot be parsed', async ({ page }) => {
  await page.goto(ARTICLE, { waitUntil: 'networkidle' })
  await expect(page.locator('.bd-mermaid-diagram')).toHaveCount(2)
  const broken = page.locator('.bd-mermaid:not(.bd-mermaid-ready)')
  await expect(broken).toHaveCount(1)
  await expect(broken.locator('.bd-code-lang')).toHaveText('mermaid')
  await expect(broken.locator('code')).toBeVisible()
})

test('does not run markup from the diagram source', async ({ page }) => {
  await page.goto(ARTICLE, { waitUntil: 'networkidle' })
  await expect(page.locator('.bd-mermaid-diagram')).toHaveCount(2)
  const handlers = await page.locator('.bd-mermaid-diagram').evaluateAll(diagrams =>
    diagrams.flatMap(diagram => Array.from(diagram.querySelectorAll('*')))
      .flatMap(element => element.getAttributeNames().filter(name => name.startsWith('on'))),
  )
  expect(handlers).toEqual([])
  await expect(page.locator('.bd-mermaid-diagram script')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
})

test('redraws the diagrams with the colors of the new theme', async ({ page }) => {
  await page.goto(ARTICLE, { waitUntil: 'networkidle' })
  const node = page.getByRole('img', { name: 'SSH login flow' }).locator('.node rect').first()
  await expect(node).toBeVisible()
  const dayFill = await node.evaluate(element => getComputedStyle(element).fill)
  await page.getByRole('group', { name: 'Color theme' }).getByRole('button', { name: 'Night' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'noche')
  await expect.poll(async () => page.getByRole('img', { name: 'SSH login flow' }).locator('.node rect').first().evaluate(element => getComputedStyle(element).fill)).not.toBe(dayFill)
})

test('only downloads Mermaid on articles with diagrams', async ({ page }) => {
  const scripts = trackMermaid(page)
  await page.goto('/blog/understanding-vue-composables', { waitUntil: 'networkidle' })
  expect(await mermaidScripts(scripts)).toEqual([])

  await page.goto(ARTICLE, { waitUntil: 'networkidle' })
  await expect(page.locator('.bd-mermaid-diagram')).toHaveCount(2)
  expect((await mermaidScripts(scripts)).length).toBeGreaterThan(0)
})
