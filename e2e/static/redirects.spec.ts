import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'

// The plugin's redirects (bogd3v/micelio#733) become the `_redirects` file of the output, which the host and scripts/static-serve.mjs answer as 301.
// The mock lists a slug change, a chain, a Spanish page and a cycle (e2e/mock-strapi.mjs)

test('the output\'s _redirects answers 301', async ({ request }) => {
  const file = readFileSync(join(process.cwd(), '.output/public/_redirects'), 'utf8')
  // The chain is resolved at build, the cycle is dropped, and the Spanish page carries its prefix
  expect(file.split('\n').filter(Boolean).sort()).toEqual([
    '/es/vieja-muestra /es/muestra 301',
    '/old-showcase /showcase 301',
    '/older-showcase /showcase 301',
  ])

  const oldAddress = await request.get('/old-showcase?utm_source=feed', { maxRedirects: 0 })
  expect(oldAddress.status()).toBe(301)
  expect(oldAddress.headers().location).toBe('/showcase?utm_source=feed')
  const chained = await request.get('/older-showcase', { maxRedirects: 0 })
  expect(chained.status()).toBe(301)
  expect(chained.headers().location).toBe('/showcase')
  const spanish = await request.get('/es/vieja-muestra', { maxRedirects: 0 })
  expect(spanish.status()).toBe(301)
  expect(spanish.headers().location).toBe('/es/muestra')

  // Followed, the old address ends on the page
  const followed = await request.get('/old-showcase')
  expect(followed.status()).toBe(200)
  expect(followed.url()).toMatch(/\/showcase$/)
  // A cycle is not served as a redirect
  expect((await request.get('/loop-a', { maxRedirects: 0 })).status()).toBe(404)
})
