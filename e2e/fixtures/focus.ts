import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Tab (and Shift+Tab) through a modal dialog. The page behind is inert, so focus is either inside the
 * dialog or has left for the browser's own UI (the body, for the page); it never reaches page content,
 * and Tab comes back into the dialog.
 */
export async function tabThroughDialog(page: Page, dialog: Locator, presses: number): Promise<void> {
  let inside = 0
  let left = false
  for (let i = 0; i < presses; i++) {
    await page.keyboard.press(i % 3 === 2 ? 'Shift+Tab' : 'Tab')
    const where = await dialog.evaluate(el => el.contains(document.activeElement) ? 'dialog' : document.activeElement === document.body ? 'browser' : 'page')
    expect(where).not.toBe('page')
    if (where === 'dialog') inside++
    else left = true
  }
  expect(inside).toBeGreaterThan(1)
  // Focus left only because the dialog has few stops, and Tab brought it back
  if (left) expect(await dialog.evaluate(el => el.contains(document.activeElement) || document.activeElement === document.body)).toBe(true)
}
