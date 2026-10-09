import { test, expect, type Page } from '@playwright/test'
import { testUsers } from '../fixtures/auth.mjs'
import { tabThroughDialog } from '../fixtures/focus'

// Dialogs and the account popover rely on the engine's own focus, Escape and dismiss rules (#245).

// The mock Strapi accepts `mock-jwt-<id>` as a session; seeding the cookie skips a sign-in form that
// WebKit cannot complete over http (it drops the Secure session cookie the server sets)
async function signInAsReader(page: Page, baseURL: string | undefined): Promise<void> {
  await page.context().addCookies([{ name: 'micelio_session', value: 'mock-jwt-101', url: baseURL!, httpOnly: true, secure: true, sameSite: 'Lax' }])
}

test.describe('search palette', () => {
  test('keeps focus inside, closes with Escape and returns focus to the opener', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    const opener = page.getByRole('button', { name: 'Search', exact: true }).and(page.locator('.bd-chip'))
    const palette = page.getByRole('dialog', { name: 'Search BogDev' })
    await opener.click()
    await expect(palette).toBeVisible()
    await expect(palette.getByRole('combobox')).toBeFocused()
    await tabThroughDialog(page, palette, 12)
    await page.keyboard.press('Escape')
    await expect(palette).toBeHidden()
    await expect(opener).toBeFocused()
  })
})

test.describe('menu sheet', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('keeps focus inside, closes with Escape and returns focus to the opener', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    const opener = page.getByRole('navigation', { name: 'Bottom navigation' }).getByRole('button', { name: 'Menu' })
    const sheet = page.getByRole('dialog', { name: 'Menu' })
    await opener.click()
    await expect(sheet).toBeVisible()
    await tabThroughDialog(page, sheet, 24)
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
    await expect(opener).toBeFocused()
  })
})

test.describe('account menu popover', () => {
  test('opens, orders the items for the keyboard and closes with Escape', async ({ page, baseURL }) => {
    await signInAsReader(page, baseURL)
    await page.goto('/blog', { waitUntil: 'networkidle' })
    const toggle = page.getByRole('button', { name: `Your account menu, ${testUsers.reader.username}` }).first()
    // The expanded state comes from popovertarget, not from an authored aria-expanded
    await expect(toggle).not.toHaveAttribute('aria-expanded')
    await toggle.focus()
    await page.keyboard.press('Enter')
    const panel = page.locator(`#${await toggle.getAttribute('aria-controls')}`)
    await expect(panel).toBeVisible()
    expect(await panel.evaluate(el => el.matches(':popover-open'))).toBe(true)

    await page.keyboard.press('Tab')
    await expect(panel.getByRole('link', { name: 'My account' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(panel.getByRole('button', { name: 'Sign out' })).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(panel).toBeHidden()
    expect(await panel.evaluate(el => el.matches(':popover-open'))).toBe(false)
    await expect(toggle).toBeFocused()
  })

  test('light dismisses on an outside click and closes on navigation', async ({ page, baseURL }) => {
    await signInAsReader(page, baseURL)
    await page.goto('/blog', { waitUntil: 'networkidle' })
    const toggle = page.getByRole('button', { name: `Your account menu, ${testUsers.reader.username}` }).first()
    await toggle.click()
    const panel = page.locator(`#${await toggle.getAttribute('aria-controls')}`)
    await expect(panel).toBeVisible()
    await page.mouse.click(5, 400)
    await expect(panel).toBeHidden()
    expect(await panel.evaluate(el => el.matches(':popover-open'))).toBe(false)

    await toggle.click()
    await panel.getByRole('link', { name: 'My account' }).click()
    await expect(page).toHaveURL(/\/account$/)
    await expect(panel).toBeHidden()
    // Closing for a navigation does not send focus back to the toggle
    await expect(toggle).not.toBeFocused()
  })

  for (const anchored of [true, false]) {
    test(`sits below the toggle inside the viewport (${anchored ? 'anchor positioning' : 'fixed fallback'})`, async ({ page, baseURL }, info) => {
      await signInAsReader(page, baseURL)
      await page.goto('/blog', { waitUntil: 'networkidle' })
      const anchorSupport = await page.evaluate(() => CSS.supports('anchor-name', '--a'))
      info.annotations.push({ type: 'anchor-positioning', description: `${info.project.name}: ${anchorSupport}` })
      if (!anchored) {
        // Drop the @supports block to see the layout a browser without anchor positioning gets
        await page.evaluate(() => {
          for (const sheet of Array.from(document.styleSheets)) {
            for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
              const rule = sheet.cssRules[i]!
              if (rule instanceof CSSSupportsRule && rule.cssText.includes('.bd-account-panel')) sheet.deleteRule(i)
            }
          }
        })
      }
      const toggle = page.getByRole('button', { name: `Your account menu, ${testUsers.reader.username}` }).first()
      await toggle.click()
      const panel = page.locator(`#${await toggle.getAttribute('aria-controls')}`)
      await expect(panel).toBeVisible()
      const [t, p, viewport] = await Promise.all([
        toggle.boundingBox(),
        panel.boundingBox(),
        page.evaluate(() => ({ width: document.documentElement.clientWidth, height: window.innerHeight })),
      ])
      expect(p!.y).toBeGreaterThanOrEqual(t!.y + t!.height - 1)
      expect(p!.x).toBeGreaterThanOrEqual(0)
      expect(p!.x + p!.width).toBeLessThanOrEqual(viewport.width + 1)
      expect(p!.y + p!.height).toBeLessThanOrEqual(viewport.height)
      // Anchored: the panel's right edge meets the toggle's
      if (anchored && anchorSupport) expect(Math.abs((p!.x + p!.width) - (t!.x + t!.width))).toBeLessThanOrEqual(2)
    })
  }
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('opens and closes the palette without animations', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    const palette = page.getByRole('dialog', { name: 'Search BogDev' })
    await page.keyboard.press('ControlOrMeta+k')
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0)
    await expect(palette).toBeVisible()
    expect(await palette.evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s')
    await page.keyboard.press('Escape')
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0)
    await expect(palette).toBeHidden()
  })

  test('opens and closes the sheet without animations', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/', { waitUntil: 'networkidle' })
    const sheet = page.getByRole('dialog', { name: 'Menu' })
    await page.getByRole('navigation', { name: 'Bottom navigation' }).getByRole('button', { name: 'Menu' }).click()
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0)
    await expect(sheet).toBeVisible()
    await page.keyboard.press('Escape')
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0)
    await expect(sheet).toBeHidden()
  })
})

test.describe('motion allowed', () => {
  test.use({ reducedMotion: 'no-preference' })

  test('animates the palette on enter and keeps it rendered while it exits', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    const palette = page.getByRole('dialog', { name: 'Search BogDev' })
    await page.keyboard.press('ControlOrMeta+k')
    await expect(palette).toBeVisible()
    await page.keyboard.press('Escape')
    // The exit transition keeps the dialog rendered for a few frames
    const exiting = await page.evaluate(() => document.getAnimations().length)
    expect(exiting).toBeGreaterThan(0)
    await expect(palette).toBeHidden()
  })

  test('keeps the query visible while the palette fades out and clears it on the next open', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    const palette = page.getByRole('dialog', { name: 'Search BogDev' })
    const input = palette.getByRole('combobox')
    await page.keyboard.press('ControlOrMeta+k')
    await input.fill('composables')
    await expect(palette.getByRole('option', { name: /Understanding Vue Composables/ })).toBeVisible()
    // Escape would clear a search field before the dialog closes: close it with the Esc button
    await palette.getByRole('button', { name: 'Close search' }).click()
    expect(await page.locator('#bd-palette-input').inputValue()).toBe('composables')
    await expect(palette).toBeHidden()
    await page.keyboard.press('ControlOrMeta+k')
    await expect(input).toHaveValue('')
  })
})
