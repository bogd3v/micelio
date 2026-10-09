import { test, expect } from '@playwright/test'

test('server-renders the about page SEO image from Strapi', async ({ request }) => {
  const html = await (await request.get('/about')).text()
  expect(html).toContain('<title>About BogDev</title>')
  expect(html).toMatch(/<meta property="og:image" content="http[^"]*\/uploads\/about-og\.png">/)
})

test('sets og:locale from the locale: en_US and es', async ({ request }) => {
  const english = await (await request.get('/')).text()
  const spanish = await (await request.get('/es')).text()
  expect(english).toContain('<meta property="og:locale" content="en_US">')
  expect(spanish).toContain('<meta property="og:locale" content="es">')
})
