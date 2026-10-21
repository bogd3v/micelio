import { test, expect } from '@playwright/test'
import sanitizeHtml from 'sanitize-html'

// The theme's messages come from the store per request (ADR 0009, section 6): the page's own locale in the payload, the other one
// fetched when the visitor switches language. Bogota's footer says where the site is made.

const footer = 'footer.myc-foot'

test('the theme text follows the language switch without a page load', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    ;(window as unknown as { spa: boolean }).spa = true
  })
  await expect(page.locator(footer)).toContainText('Made in Bogotá, Colombia')

  const [fetched] = await Promise.all([
    page.waitForResponse(response => /\/_t\/[0-9a-f]{64}\/runtime\.json$/.test(response.url())),
    page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'Español' }).click(),
  ])
  expect(fetched.status()).toBe(200)
  expect(fetched.headers()['cache-control']).toContain('immutable')
  await expect(page).toHaveURL(/\/es$/)
  await expect(page.locator(footer)).toContainText('Hecho en Bogotá, Colombia')
  await expect(page.locator(footer)).not.toContainText('Made in')

  // Back to the first language: its messages are already there, so nothing is fetched again
  let again = 0
  page.on('request', (request) => {
    if (request.url().includes('/runtime.json')) again++
  })
  await page.getByRole('group', { name: 'Idioma' }).getByRole('button', { name: 'English' }).click()
  await expect(page.locator(footer)).toContainText('Made in Bogotá, Colombia')
  expect(again).toBe(0)
  expect(await page.evaluate(() => (window as unknown as { spa?: boolean }).spa)).toBe(true)
})

test('a page opened in the other language has its theme text in the first response', async ({ request }) => {
  // The text the page renders: a parser drops every tag and script, the payload with them
  const html = sanitizeHtml(await (await request.get('/es')).text(), { allowedTags: [], allowedAttributes: {} })
  expect(html).toContain('Hecho en Bogotá, Colombia')
  expect(html).not.toContain('Made in Bogotá')
})
