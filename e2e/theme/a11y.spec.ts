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
