import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// Cross-document view transitions, card -> article (ADR 0005, section 10). The static site ships no JS,
// so the test records pageswap/pagereveal itself. Only Chromium has the API: elsewhere the navigation just completes.
interface Seen { swap: boolean, reveal: boolean }

async function record(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.addEventListener('pageswap', (event) => {
      if ((event as Event & { viewTransition?: unknown }).viewTransition) sessionStorage.setItem('vt-swap', '1')
    })
    window.addEventListener('pagereveal', (event) => {
      if ((event as Event & { viewTransition?: unknown }).viewTransition) sessionStorage.setItem('vt-reveal', '1')
    })
  })
}

async function openFirstCard(page: Page): Promise<void> {
  await page.goto('/blog')
  const link = page.locator('.bd-card-link').first()
  await expect(link).toBeVisible()
  await Promise.all([page.waitForURL(/\/blog\/[^/]+$/), link.click()])
  await expect(page.locator('h1')).toBeVisible()
}

async function seen(page: Page): Promise<Seen> {
  return page.evaluate(() => ({ swap: sessionStorage.getItem('vt-swap') === '1', reveal: sessionStorage.getItem('vt-reveal') === '1' }))
}

test.describe('motion allowed', () => {
  test.use({ reducedMotion: 'no-preference' })

  for (const path of ['/', '/es', '/blog', '/blog/understanding-vue-composables', '/es/blog/guia-vue-composables']) {
    test(`${path} has no duplicate view-transition-name`, async ({ page }) => {
      await page.goto(path)
      const names = await page.$$eval('body *', nodes => nodes.map(node => getComputedStyle(node).viewTransitionName).filter(name => name !== 'none'))
      expect(names.filter(name => name.startsWith('bd-post-')).length).toBeGreaterThan(0)
      expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([])
    })
  }

  test('the article header takes the names of its card', async ({ page }) => {
    await page.goto('/blog')
    const href = await page.locator('.bd-card-link').first().getAttribute('href')
    const card = await page.locator('.bd-card-title').first().evaluate(node => getComputedStyle(node).viewTransitionName)
    await page.goto(href!)
    expect(card).not.toBe('none')
    expect(await page.locator('h1.bd-post-title').evaluate(node => getComputedStyle(node).viewTransitionName)).toBe(card)
  })

  test('a card opens its article with a view transition where the API exists', async ({ page }) => {
    await page.goto('/')
    test.skip(!(await page.evaluate(() => 'onpagereveal' in window)), 'The browser has no cross-document view transitions')
    await record(page)
    await openFirstCard(page)
    expect(await seen(page)).toEqual({ swap: true, reveal: true })
  })

  test('navigation completes where the API is missing', async ({ page }) => {
    await page.goto('/')
    test.skip(await page.evaluate(() => 'onpagereveal' in window), 'The browser has cross-document view transitions')
    await record(page)
    await openFirstCard(page)
    expect(await seen(page)).toEqual({ swap: false, reveal: false })
  })
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('there is no transition and no animation', async ({ page }) => {
    await record(page)
    await openFirstCard(page)
    expect(await seen(page)).toEqual({ swap: false, reveal: false })
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0)
    expect(await page.locator('h1.bd-post-title').evaluate(node => getComputedStyle(node).viewTransitionName)).toBe('none')
  })
})
