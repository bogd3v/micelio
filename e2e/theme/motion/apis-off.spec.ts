import { test, expect, type Page } from '@playwright/test'
import { MOTION_PAGES, accountToggle, collectErrors, disableNativeMotionApis, open, scrollThrough, signInAsReader } from './support'

// The native motion APIs are off (an unsupported browser): every page is complete and the dialogs work (ADR 0005, section 10; #245).
// Projects `<mode>-apis-off-chromium` (the APIs removed as support.ts describes) and `<mode>-apis-off-firefox`
// (no scroll timelines, view transitions off by preference, the rest as in the Chromium project).

test.beforeEach(async ({ page }) => {
  await disableNativeMotionApis(page)
})

// The route callback of disableNativeMotionApis fetches each stylesheet: one still in flight when the test ends would be reported as
// `route.fetch: Test ended` and fail the run although every test passed (run 38056056933)
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' })
})

/** Elements that paint (not display:none, not visibility:hidden) yet are transparent, or sit outside the page where nothing scrolls to them */
async function hiddenByMotion(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = []
    const width = document.documentElement.clientWidth
    for (const element of document.body.querySelectorAll('*')) {
      const style = getComputedStyle(element)
      if (style.display === 'none' || element.closest('[class*="-enter-"], [class*="-leave-"], [hidden], [inert], dialog:not([open]), [popover]:not(:popover-open), svg, noscript, template')) continue
      const rect = element.getBoundingClientRect()
      if (!rect.width || !rect.height) continue
      const label = `${element.tagName.toLowerCase()}${typeof element.className === 'string' && element.className ? `.${element.className.trim().split(/\s+/).join('.')}` : ''}`
      const exempt = element.closest('.myc-sr, .myc-skip, [aria-hidden="true"]')
      if (style.visibility === 'hidden' && !exempt) {
        // A broken image (the mock's CORS block) is hidden by Firefox, with the media box that holds only it
        const brokenImage = element.matches('img') || (element.querySelector('img') && !element.textContent?.trim())
        if (!brokenImage && !Array.from(element.children).some(child => getComputedStyle(child).visibility === 'visible')) found.push(`${label}: visibility hidden`)
        continue
      }
      if (Number(style.opacity) === 0 && !exempt) found.push(`${label}: opacity 0`)
      // Reveal and parallax layers move by a transform only: it must be gone without the timeline
      if (element.matches('.myc-reveal, .myc-guide-card') && (style.transform !== 'none' || style.translate !== 'none' || style.scale !== 'none' || style.animationName !== 'none')) found.push(`${label}: transform ${style.transform}, translate ${style.translate}, scale ${style.scale}, animation ${style.animationName}`)
      if (element.matches('.myc-reveal') && (rect.left > width || rect.right < 0)) found.push(`${label}: outside the page`)
    }
    return found
  })
}

test('the browser lacks the APIs', async ({ page }) => {
  await open(page, MOTION_PAGES[0]!)
  const support = await page.evaluate(() => ({
    scrollTimeline: CSS.supports('animation-timeline', 'scroll()'),
    viewTimeline: CSS.supports('animation-timeline', 'view()'),
    anchor: CSS.supports('anchor-name', '--a'),
    viewTransition: typeof document.startViewTransition,
  }))
  expect(support).toEqual({ scrollTimeline: false, viewTimeline: false, anchor: false, viewTransition: 'undefined' })
  // No scroll-driven animation survives in the styles either
  expect(await page.evaluate(() => document.getAnimations().filter(animation => animation.timeline && !(animation.timeline instanceof DocumentTimeline)).length)).toBe(0)
})

for (const entry of MOTION_PAGES) {
  test(`${entry.name} is complete`, async ({ page }) => {
    const errors = collectErrors(page)
    await open(page, entry)
    await scrollThrough(page)
    expect(await hiddenByMotion(page)).toEqual([])
    // Every reveal and focus item reads as it does at rest
    expect(await page.locator('.myc-reveal').evaluateAll(items => items.map(item => getComputedStyle(item).opacity).filter(opacity => opacity !== '1'))).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    // The specimen shows every hero variant, each with its own h1
    if (entry.name !== 'specimen') await expect(page.locator('main h1')).toHaveCount(1)
    await expect(page.locator('main h1').first()).toBeVisible()
    expect(errors).toEqual([])
  })
}

test('the home has reveal items to check', async ({ page }) => {
  await open(page, MOTION_PAGES[0]!)
  expect(await page.locator('.myc-reveal').count()).toBeGreaterThan(0)
})

test('the header progress needs no scroll timeline', async ({ page }) => {
  await open(page, MOTION_PAGES[2]!)
  await scrollThrough(page)
  const bar = page.locator('.myc-progress-bar').first()
  expect(await page.locator('.myc-progress-bar').count()).toBeGreaterThan(0)
  expect(await bar.evaluate(element => getComputedStyle(element).animationName)).toBe('none')
})

test('the theme switch changes the mode without view transitions', async ({ page }) => {
  await open(page, MOTION_PAGES[0]!)
  const html = page.locator('html')
  const before = await html.getAttribute('data-theme')
  const other = page.locator('.myc-seg[data-mode][aria-pressed="false"]:visible').first()
  test.skip(!(await other.count()), 'the theme has a single mode')
  await other.click()
  await expect(html).not.toHaveAttribute('data-theme', before!)
})

test('the search palette opens and closes with the keyboard', async ({ page }) => {
  await open(page, MOTION_PAGES[0]!)
  const palette = page.getByRole('dialog', { name: 'Search BogDev' })
  await page.keyboard.press('ControlOrMeta+k')
  await expect(palette).toBeVisible()
  await expect(palette.getByRole('combobox')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(palette).toBeHidden()
})

test.describe('menu sheet', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('opens and closes with the keyboard', async ({ page }) => {
    await open(page, MOTION_PAGES[0]!)
    const opener = page.getByRole('navigation', { name: 'Bottom navigation' }).getByRole('button', { name: 'Menu' })
    const sheet = page.getByRole('dialog', { name: 'Menu' })
    await opener.focus()
    await page.keyboard.press('Enter')
    await expect(sheet).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
    await expect(opener).toBeFocused()
  })
})

test('the account menu opens and closes with the keyboard, below its toggle without anchor positioning', async ({ page, baseURL }) => {
  await signInAsReader(page, baseURL)
  await open(page, { name: 'blog', path: '/blog' })
  const toggle = accountToggle(page)
  await toggle.focus()
  await page.keyboard.press('Enter')
  const panel = page.locator(`#${await toggle.getAttribute('aria-controls')}`)
  await expect(panel).toBeVisible()
  expect(await panel.evaluate(element => getComputedStyle(element).position)).toBe('fixed')
  // Vue's inline `anchor-name` / `position-anchor` did not reach the elements
  expect(await toggle.evaluate(element => (element as HTMLElement).style.cssText)).not.toContain('anchor')
  expect(await panel.evaluate(element => (element as HTMLElement).style.cssText)).not.toContain('anchor')
  const [toggleBox, panelBox, viewport] = await Promise.all([
    toggle.boundingBox(),
    panel.boundingBox(),
    page.evaluate(() => ({ width: document.documentElement.clientWidth, height: window.innerHeight })),
  ])
  expect(panelBox!.y).toBeGreaterThanOrEqual(toggleBox!.y + toggleBox!.height - 1)
  expect(panelBox!.x).toBeGreaterThanOrEqual(0)
  expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(viewport.width + 1)
  await page.keyboard.press('Tab')
  await expect(panel.getByRole('link', { name: 'My account' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  await expect(toggle).toBeFocused()
})
