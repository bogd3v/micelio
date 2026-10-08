import { test, expect } from '@playwright/test'

// #244 criterion "switching themes does not require touching the page content": scripts/test-landing.mjs builds the same
// site with the default theme and again with NUXT_PUBLIC_THEME=starter, and runs this spec on both. The page content, its
// section ids and the navigation do not depend on the theme.
const THEME = process.env.LANDING_THEME

test('the home page has the same content and navigation whatever the theme', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Grow food where you live')
  const headings = await page.locator('main h2').allTextContents()
  expect(headings.slice(0, 3)).toEqual(['What you need', 'A balcony in spring', 'One small garden'])
  const ids = await page.locator('main [id^="section-"]').evaluateAll(sections => sections.map(section => section.id))
  expect(ids.slice(0, 3)).toEqual(['section-what-you-need', 'section-a-balcony-in-spring', 'section-one-small-garden'])
  const nav = await page.getByRole('navigation', { name: 'Navigate' }).locator('a[href^="/#section-"]').evaluateAll(links => links.map(link => link.getAttribute('href')))
  expect(nav).toHaveLength(ids.length)
  for (const href of nav) expect(ids).toContain(href!.replace('/#', ''))
})

test('the theme that was built is the one that renders', async ({ request }) => {
  test.skip(!THEME, 'the default theme run')
  const html = await (await request.get('/')).text()
  expect(html).not.toContain('data-theme="noche"')
  expect(html).toMatch(/data-theme="(?:light|dark)"/)
})
