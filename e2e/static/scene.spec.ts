import { test, expect } from '@playwright/test'

// #246 in a static site: the model was copied into /_media/, so the island fetches it from 'self' and the one policy needs no connect-src source
const SCENE = 'micelio-scene'

// /scene-hero's model carries a PNG: it reaches the GPU through a data: URL, the only image URL the static policy allows besides 'self' (no blob:)
for (const path of ['/showcase', '/scene-hero']) test(`${path}: the scene draws its model from /_media/ under the static policy, with no violation and no request outside the site`, async ({ page, baseURL }) => {
  const outside: string[] = []
  const violations: string[] = []
  page.on('request', (request) => {
    if (!request.url().startsWith(baseURL!) && !request.url().startsWith('data:')) outside.push(request.url())
  })
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', event => console.error(`csp ${event.violatedDirective} ${event.blockedURI}`)))
  page.on('console', (message) => {
    if (/^csp /.test(message.text()) || /content security policy/i.test(message.text())) violations.push(message.text())
  })
  const models: string[] = []
  page.on('request', (request) => {
    if (request.url().endsWith('.glb')) models.push(new URL(request.url()).pathname)
  })
  await page.goto(path, { waitUntil: 'load' })
  const webgl = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return gl !== null
  })
  await page.locator(SCENE).scrollIntoViewIfNeeded()
  if (webgl) {
    await expect(page.locator(SCENE)).toHaveAttribute('data-state', 'ready')
    expect(models).toHaveLength(1)
    expect(models[0]).toMatch(/^\/_media\/[\da-f]{8}-(?:triangle|textured)\.glb$/)
  } else {
    // Headless without WebGL2: the poster stays and nothing is fetched
    await page.waitForTimeout(2000)
    expect(models).toEqual([])
    await expect(page.locator(SCENE).locator('img')).toBeVisible()
  }
  expect(violations).toEqual([])
  expect(outside).toEqual([])
})
