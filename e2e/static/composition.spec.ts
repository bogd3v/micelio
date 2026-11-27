import { test, expect } from '@playwright/test'

// Page composition (ADR 0022) in a static build: the `composition` page of the mock Strapi opens with a band of three members, a hero,
// stats and a reference that draws its published target, a newsletter. The band is markup: no script draws it
test('the composition page wraps its band in myc-group with data-tone accent', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/composition')
  const band = page.locator('.myc-group')
  await expect(band).toHaveCount(1)
  await expect(band).toHaveAttribute('data-tone', 'accent')
  expect(await band.evaluate(node => [...node.children].map(child => child.getAttribute('data-section')))).toEqual(['hero', 'stats', 'newsletter'])
  // The call to action after it is outside any band, and the references outside it draw nothing
  expect(await page.locator('section.myc-section').evaluateAll(nodes => nodes.map(node => [node.getAttribute('data-section'), node.parentElement!.classList.contains('myc-group')]))).toEqual([
    ['hero', true],
    ['stats', true],
    ['newsletter', true],
    ['cta', false],
  ])
  await expect(page.locator('[data-myc-block], [data-myc-index]')).toHaveCount(0)
  await context.close()
})

// The static build reads the targets as the server does, with the build token (ADR 0006): the reference in the band draws its published
// target, and the one whose target is missing in English draws nothing
test('a reference renders its target in the static page', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/composition')
  const target = page.locator('.myc-group[data-tone="accent"] > section.myc-section[data-section="newsletter"]')
  await expect(target).toHaveCount(1)
  await expect(target).toContainText('A reusable newsletter')
  await expect(target.locator('form')).toHaveCount(1)
  await expect(page.getByText('Un anuncio')).toHaveCount(0)
  await context.close()
})
