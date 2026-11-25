import { test, expect } from '@playwright/test'

// Page composition (ADR 0022) in a static build: the `composition` page of the mock Strapi opens with a band of three members, a hero,
// stats and a reference whose target is not read yet (bogd3v/micelio#987), which draws nothing. The band is markup: no script draws it
test('the composition page wraps its band in myc-group with data-tone accent', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/composition')
  const band = page.locator('.myc-group')
  await expect(band).toHaveCount(1)
  await expect(band).toHaveAttribute('data-tone', 'accent')
  expect(await band.evaluate(node => [...node.children].map(child => child.getAttribute('data-section')))).toEqual(['hero', 'stats'])
  // The call to action after it is outside any band, and the references outside it draw nothing
  expect(await page.locator('section.myc-section').evaluateAll(nodes => nodes.map(node => [node.getAttribute('data-section'), node.parentElement!.classList.contains('myc-group')]))).toEqual([
    ['hero', true],
    ['stats', true],
    ['cta', false],
  ])
  await expect(page.locator('[data-myc-block], [data-myc-index]')).toHaveCount(0)
  await context.close()
})
