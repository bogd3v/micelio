import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { PAGES, openPage } from './support'

for (const entry of PAGES) {
  test(`${entry.name} has no axe violations`, async ({ page }) => {
    await openPage(page, entry)
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const summary = results.violations.map(violation => `${violation.id}: ${violation.nodes.map(node => node.target.join(' ')).join(' | ')}`)
    expect(summary).toEqual([])
  })
}

test('the specimen keeps every id unique after hydration', async ({ page }) => {
  const entry = PAGES.find(item => item.name === 'specimen')!
  await openPage(page, entry)
  const duplicates = await page.evaluate(() => {
    const count: Record<string, number> = {}
    for (const element of document.querySelectorAll('[id]')) count[element.id] = (count[element.id] ?? 0) + 1
    return Object.keys(count).filter(id => count[id]! > 1)
  })
  expect(duplicates).toEqual([])
})
