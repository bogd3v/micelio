import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'

// ADR 0009, section 7: a static site has no server to answer /_t/<digest>/, so the build theme's files are published at that URL

const FOLDER = join(process.cwd(), '.output/public/_t')

function digest(): string {
  const found = readdirSync(FOLDER)
  expect(found).toHaveLength(1)
  return found[0]!
}

test('publishes the build theme\'s stylesheet, data, fonts and images under its digest, and only those', async ({ request }) => {
  const root = `/_t/${digest()}`
  expect(digest()).toMatch(/^[0-9a-f]{64}$/)
  const css = await (await request.get(`${root}/theme.css`)).text()
  const font = new RegExp(`${root}/fonts/[\\w.-]+\\.woff2`).exec(css)?.[0]
  expect(font).toBeTruthy()
  expect((await request.get(font!)).status()).toBe(200)
  // The integrity manifest and the data file are for the server; a static page has no script to read them
  for (const file of ['manifest.json', 'runtime.json']) expect((await request.get(`${root}/${file}`)).status(), file).toBe(404)
  expect((await request.get(`/_t/${'0'.repeat(64)}/theme.css`)).status()).toBe(404)
})

test('serves them immutable and sandboxed through the _headers file', async ({ request }) => {
  const response = await request.get(`/_t/${digest()}/theme.css`)
  expect(response.headers()['cache-control']).toContain('immutable')
  expect(response.headers()['content-security-policy']).toContain('sandbox')
  expect(response.headers()['content-type']).toContain('text/css')
})
