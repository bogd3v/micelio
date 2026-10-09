import { test, expect } from '@playwright/test'

// ADR 0006, section 5: the newsletter is a plain form post to the provider; scripts/test-static.mjs builds the site
// with its action pointing at a receiver on STATIC_RECEIVER_PORT and keeps the last post
const receiver = `http://127.0.0.1:${process.env.STATIC_RECEIVER_PORT ?? '3270'}`
const PAGES = [
  { path: '/', privacy: '/privacy' },
  { path: '/es', privacy: '/es/privacy' },
  { path: '/blog/understanding-vue-composables', privacy: '/privacy' },
]

for (const { path, privacy } of PAGES) {
  test(`${path}: the newsletter is a plain form to the provider`, async ({ request }) => {
    const html = await (await request.get(path)).text()
    const form = /<form class="myc-news[^"]*"[^>]*>[\s\S]*?<\/form>/.exec(html)?.[0] ?? ''
    expect(form).toContain(`method="post" action="${receiver}/subscribe"`)
    expect(form).toMatch(/<input id="[^"]+" class="myc-input" type="email" name="email" autocomplete="email" required/)
    expect(form).toMatch(/<label for="[^"]+"/)
    expect(form).toMatch(/<button[^>]*type="submit"/)
    expect(form).toContain(`href="${privacy}"`)
    expect(form).not.toMatch(/novalidate|onsubmit|data-v-|target=/)
  })
}

test('form-action carries the provider origin in the header and in the meta', async ({ request }) => {
  const response = await request.get('/')
  const header = response.headers()['content-security-policy'] ?? ''
  const meta = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(await response.text())?.[1] ?? ''
  expect(header).toContain(`form-action 'self' ${receiver};`)
  expect(meta).toContain(`form-action 'self' ${receiver};`)
})

test('without JavaScript the form posts the email to the provider and follows its redirect', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  const violations: string[] = []
  page.on('console', message => message.text().includes('Content Security Policy') && violations.push(message.text()))
  await page.goto('/')
  const email = page.locator('form.myc-news input[type="email"]').first()
  await email.fill('reader@example.com')
  // Enter in the field is the native submit
  await email.press('Enter')
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  expect(page.url()).toBe(`${receiver}/thanks`)
  expect(await (await fetch(`${receiver}/last`)).json()).toBe('email=reader%40example.com')
  expect(violations).toEqual([])
  await context.close()
})

test('the privacy page names the provider', async ({ request }) => {
  const html = await (await request.get('/privacy')).text()
  expect(html).toMatch(/Newsletter:<\/strong> if you subscribe, your email goes to 127\.0\.0\.1/)
})
