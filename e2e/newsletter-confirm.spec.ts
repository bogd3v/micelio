import { test, expect } from '@playwright/test'
import type { Locator } from '@playwright/test'

// The card's shape and tone come from the theme's roles (#285)
async function expectRoleStyles(card: Locator): Promise<void> {
  const { actual, roles } = await card.evaluate((el) => {
    const tone = el.getAttribute('data-status') === 'success' ? 'success' : 'danger'
    const probe = document.createElement('div')
    probe.style.cssText = `border: 1px solid var(--${tone}); border-radius: var(--radius-card); background-color: var(--${tone}-soft); color: var(--${tone})`
    el.parentElement!.append(probe)
    const pick = (s: CSSStyleDeclaration, color: string): string[] => [s.borderTopLeftRadius, s.borderTopColor, s.backgroundColor, color]
    const card = getComputedStyle(el)
    const icon = getComputedStyle(el.querySelector('.myc-confirm-icon')!)
    const role = getComputedStyle(probe)
    const result = { actual: pick(card, icon.color), roles: pick(role, role.color) }
    probe.remove()
    return result
  })
  expect(actual).toEqual(roles)
}

test('confirms a subscription from the link in the email', async ({ page }) => {
  // Mocked so the shared mock-Strapi subscriber stays pending for other specs
  await page.route('**/api/newsletter/confirm?*', route => route.fulfill({ json: { success: true, alreadyConfirmed: false, message: '' } }))
  await page.goto('/confirm?token=confirmation-token-pending-0001')

  await expect(page.getByRole('heading', { level: 1, name: 'Subscription Confirmed!' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Browse Blog' })).toHaveAttribute('href', '/blog')
  await expectRoleStyles(page.locator('.myc-confirm-card'))
})

test('explains an invalid confirmation link', async ({ page }) => {
  await page.goto('/confirm?token=bad')

  await expect(page.getByRole('heading', { level: 1, name: 'Confirmation Failed' })).toBeVisible()
  await expect(page.getByText('The confirmation link is invalid or has expired.')).toBeVisible()
  await expectRoleStyles(page.locator('.myc-confirm-card'))
})
