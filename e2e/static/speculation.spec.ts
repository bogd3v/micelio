import { createHash } from 'node:crypto'
import { test, expect } from '@playwright/test'
import { inlineScripts } from '../../app/helpers/securityHeaders'

// ADR 0004 and ADR 0006 amendments: one hashed speculationrules script, the same on every page
const PAGES = ['/', '/es', '/blog', '/blog/understanding-vue-composables', '/showcase', '/privacy', '/blog/does-not-exist']
const SCRIPT = /<script type="speculationrules">([\s\S]*?)<\/script>/g

function rulesIn(html: string): string[] {
  return [...html.matchAll(SCRIPT)].map(match => match[1]!)
}

async function rulesOf(request: import('@playwright/test').APIRequestContext, path: string): Promise<string[]> {
  return rulesIn(await (await request.get(path)).text())
}

for (const path of PAGES) {
  test(`${path}: one speculationrules script that parses, covered by the CSP`, async ({ request }) => {
    const response = await request.get(path)
    const html = await response.text()
    const rules = rulesIn(html)
    expect(rules).toHaveLength(1)
    const parsed = JSON.parse(rules[0]!) as { prerender?: unknown[], prefetch: unknown[] }
    expect(parsed.prerender?.length ?? 0).toBeGreaterThan(0)
    expect(parsed.prefetch.length).toBeGreaterThan(0)
    const hash = `'sha256-${createHash('sha256').update(rules[0]!).digest('base64')}'`
    expect(inlineScripts(html)).toContain(rules[0])
    expect(response.headers()['content-security-policy']).toContain(hash)
    expect(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(html)?.[1]).toContain(hash)
  })
}

test('the rules are identical on every page', async ({ request }) => {
  const all = await Promise.all(PAGES.map(path => rulesOf(request, path)))
  expect(new Set(all.map(rules => rules.join())).size).toBe(1)
})

test('the browser reports no CSP violation and navigation works', async ({ page }) => {
  const messages: string[] = []
  page.on('console', message => message.text().includes('Content Security Policy') && messages.push(message.text()))
  await page.addInitScript(() => {
    const found: string[] = []
    ;(window as unknown as { __violations: string[] }).__violations = found
    document.addEventListener('securitypolicyviolation', event => found.push(`${event.violatedDirective} ${event.blockedURI}`))
  })
  await page.goto('/', { waitUntil: 'networkidle' })
  const link = page.locator('a[href="/blog"]').first()
  await link.hover()
  await link.click()
  await expect(page).toHaveURL(/\/blog$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { __violations: string[] }).__violations)).toEqual([])
  expect(messages).toEqual([])
})
