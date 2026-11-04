import { test, expect } from '@playwright/test'

// The options of the article blocks (#731) in a static build: its HTML inlines the rules of the article blocks and loads no script, so
// the rule of a centered quote must win over the quote's own without JavaScript and before any stylesheet of the renderer arrives
test('a centered quote has the bar on top and none on the left, with JavaScript off', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/es/blog/guia-vue-composables')
  const quote = page.locator('blockquote.myc-quote[data-align="center"]')
  await expect(quote).toHaveCount(1)
  await expect(quote).toHaveCSS('padding-left', '0px')
  await expect(quote).toHaveCSS('border-left-width', '0px')
  await expect(quote).toHaveCSS('border-top-width', '4px')
  await expect(quote).toHaveCSS('text-align', 'center')
  await context.close()
})

// The rule of the ratio must out-rank `.myc-prose .myc-fig-media img { height: auto }` of figure.css: a static article inlines the option
// rules before the entry stylesheet, so a tie goes to the later one and the image stays the shape of its file under a box cut to a square
test('an image with ratio 1:1 or 4:3 fills its box, with JavaScript off', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/es/blog/guia-vue-composables')
  for (const ratio of ['1:1', '4:3']) {
    const media = page.locator(`.myc-fig[data-ratio="${ratio}"]:not(.myc-slider) .myc-fig-media`).first()
    await expect(media).toHaveCount(1)
    const box = (await media.boundingBox())!
    const image = (await media.locator('img').boundingBox())!
    expect(image.height, `image under ratio ${ratio}`).toBeGreaterThanOrEqual(box.height - 3)
    expect(image.width, `image under ratio ${ratio}`).toBeGreaterThanOrEqual(box.width - 3)
  }
  await context.close()
})
