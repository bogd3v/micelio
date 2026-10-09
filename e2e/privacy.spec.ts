import { test, expect } from '@playwright/test'

test('shows the privacy notice once and remembers «Got it»', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  const notice = page.getByRole('region', { name: 'Privacy notice' })
  await expect(notice).toBeVisible()
  await expect(notice).toContainText('No tracking cookies. We count visits anonymously with Umami.')
  await expect(notice.getByRole('link', { name: 'Learn more' })).toHaveAttribute('href', '/privacy')
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true)

  await notice.getByRole('button', { name: 'Got it' }).click()
  await expect(notice).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('micelio-privacy-notice'))).toBe('1')

  await page.reload({ waitUntil: 'networkidle' })
  await page.goto('/blog', { waitUntil: 'networkidle' })
  await expect(page.locator('.bd-privacy-notice')).toHaveCount(0)
})

test('places the notice above the tab bar on mobile', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto('/', { waitUntil: 'networkidle' })
  const notice = await page.locator('.bd-privacy-notice').boundingBox()
  const tabBar = await page.locator('.bd-tabbar').boundingBox()
  expect(notice).not.toBeNull()
  expect(tabBar).not.toBeNull()
  expect(notice!.x).toBe(12)
  expect(notice!.width).toBe(390 - 24)
  expect(Math.round(tabBar!.y - (notice!.y + notice!.height))).toBe(12)
  await page.close()
})

test('works without JavaScript and never shows the notice', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('.bd-privacy-notice')).toHaveCount(0)
  await page.goto('/privacy')
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy and cookies' })).toBeVisible()
  await context.close()
})

test('writes no cookies without a session', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'es-CO', extraHTTPHeaders: { 'accept-language': 'es-CO,es;q=0.9' } })
  const page = await context.newPage()
  await page.goto('/', { waitUntil: 'networkidle' })
  await expect(page).toHaveURL(/\/es$/)
  await page.getByRole('region', { name: 'Aviso de privacidad' }).getByRole('button', { name: 'Entendido' }).click()
  await page.getByRole('group', { name: 'Tema de color' }).getByRole('button').first().click()
  await page.goto('/es/blog', { waitUntil: 'networkidle' })
  await page.goto('/es/privacy', { waitUntil: 'networkidle' })
  expect(await context.cookies()).toEqual([])
  await context.close()
})

test('names no pre-rename cookie or key in either locale', async ({ page }) => {
  for (const [path, names] of [
    ['/privacy', ['micelio_session', 'micelio-theme', 'micelio-privacy-notice', 'micelio-read-articles']],
    ['/es/privacy', ['micelio_session', 'micelio-theme', 'micelio-privacy-notice', 'micelio-read-articles']],
  ] as const) {
    await page.goto(path, { waitUntil: 'networkidle' })
    const text = await page.locator('main').innerText()
    for (const name of names) expect(text).toContain(name)
    for (const old of ['bd_session', 'bd-theme', 'bd-privacy-notice', 'bd-read-articles']) expect(text).not.toContain(old)
  }
})

test('lists exactly the cookies and browser keys the site uses', async ({ page }) => {
  await page.goto('/privacy', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy and cookies' })).toBeVisible()

  const cookies = await page.locator('#cookies tbody td:first-child').allTextContents()
  expect(cookies).toEqual(['micelio_session'])
  const listed = await page.locator('#browser dt').allTextContents()
  expect(listed).toEqual(['micelio-theme', 'micelio-privacy-notice', 'micelio-read-articles'])

  await page.getByRole('button', { name: 'Got it' }).click()
  await page.getByRole('group', { name: 'Color theme' }).getByRole('button', { name: 'Night' }).click()
  await page.goto('/blog/understanding-vue-composables', { waitUntil: 'networkidle' })
  await page.locator('.bd-prose').evaluate(element => element.scrollIntoView({ block: 'end' }))
  await expect.poll(() => page.evaluate(() => localStorage.getItem('micelio-read-articles'))).not.toBeNull()

  const stored = await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)])
  expect(stored.sort()).toEqual([...listed].sort())
})

test('links the privacy page from the footer and the sign-up form', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.locator('.bd-foot-credits').getByRole('link', { name: 'Privacy and cookies' }).click()
  await expect(page).toHaveURL(/\/privacy$/)
  await page.goto('/account/sign-up', { waitUntil: 'networkidle' })
  await expect(page.locator('.bd-check a')).toHaveAttribute('href', '/privacy')
})
