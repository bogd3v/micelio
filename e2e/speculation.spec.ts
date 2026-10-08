import { test, expect } from '@playwright/test'

// ADR 0006 amendment: the dynamic site ships no speculation rules (Nuxt prefetches on interaction)
for (const path of ['/', '/blog', '/es']) {
  test(`${path}: no speculationrules script`, async ({ request }) => {
    expect(await (await request.get(path)).text()).not.toContain('speculationrules')
  })
}
