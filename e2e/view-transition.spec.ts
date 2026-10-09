import { test, expect } from '@playwright/test'

// Dynamic mode: Nuxt's router view transition reuses the names of the cross-document one (ADR 0005, section 10)
test.use({ reducedMotion: 'no-preference' })

test('a card opens its article on client navigation, with no duplicate-name error', async ({ page, browserName }) => {
  const problems: string[] = []
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type()) && /view.?transition|duplicate/i.test(message.text())) problems.push(message.text())
  })
  page.on('pageerror', error => problems.push(error.message))

  await page.goto('/', { waitUntil: 'networkidle' })
  const titles = await page.$$eval('.bd-post-title', nodes => nodes.map(node => getComputedStyle(node).viewTransitionName).filter(name => name !== 'none'))
  expect(new Set(titles).size).toBe(titles.length)

  const link = page.locator('.bd-card-link').first()
  const href = await link.getAttribute('href')
  const started = page.evaluate(() => new Promise<boolean>((resolve) => {
    const original = document.startViewTransition?.bind(document)
    if (!original) return resolve(false)
    document.startViewTransition = ((...args: Parameters<Document['startViewTransition']>) => {
      resolve(true)
      return original(...args)
    }) as Document['startViewTransition']
    setTimeout(() => resolve(false), 5000)
  }))
  await link.click()
  await expect(page).toHaveURL(new RegExp(`${href}$`))
  await expect(page.locator('h1.bd-post-title')).toBeVisible()
  if (browserName === 'chromium') expect(await started).toBe(true)
  expect(problems).toEqual([])
})
