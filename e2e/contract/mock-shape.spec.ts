import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { mockIssues, shapeOf } from '../../scripts/contract/shape.mjs'
import { FRONTEND_REQUESTS, KNOWN_DIFFERENCES, MOCK_ROUTES, routeOf, servedBy } from './mock-shape'
import { CMS_URL, STRAPI_TOKEN } from './support'

// The mock Strapi (e2e/mock-strapi.mjs) is what the fast suites run against. Here the frontend asks the real CMS through a recording
// proxy, and each Strapi request it made is repeated on the mock: the mock may not answer a key the CMS does not have, or a type it
// does not use (what it leaves out is a simplification). Differences are accepted only when listed with their reason.
const MOCK_URL = `http://127.0.0.1:${process.env.CONTRACT_MOCK_PORT ?? 3272}`

interface Recorded {
  method: string
  url: string
}

test('the mock Strapi answers with the shapes of the real CMS', async ({ request }) => {
  for (const path of FRONTEND_REQUESTS) await request.get(path)
  const recorded: Recorded[] = readFileSync(process.env.CONTRACT_RECORD_FILE!, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line))
  const urls = [...new Set(recorded.filter(entry => entry.method === 'GET').map(entry => entry.url))]
  expect(urls.length, 'the frontend made no request to the CMS').toBeGreaterThan(0)

  const found: Array<{ route: string, issue: string }> = []
  for (const url of urls) {
    const route = routeOf(url)
    const real = await fetch(`${CMS_URL}${url}`, { headers: { Authorization: `Bearer ${STRAPI_TOKEN}` } })
    const mock = await fetch(`${MOCK_URL}${url}`)
    if (real.status !== mock.status) {
      found.push({ route, issue: `status: the mock answers ${mock.status}, the CMS ${real.status}` })
      continue
    }
    for (const issue of mockIssues(shapeOf(await mock.json()), shapeOf(await real.json()))) found.push({ route, issue })
  }

  const known = (entry: { route: string, issue: string }) => KNOWN_DIFFERENCES.some(difference => difference.route === entry.route && difference.issue === entry.issue)
  const unexpected = [...new Set(found.filter(entry => !known(entry)).map(entry => `${entry.route} ${entry.issue}`))]
  const stale = KNOWN_DIFFERENCES.filter(difference => !found.some(entry => entry.route === difference.route && entry.issue === difference.issue)).map(difference => `${difference.route} ${difference.issue}`)
  const routes = [...new Set(urls.map(routeOf))]
  const unreached = Object.entries(MOCK_ROUTES).filter(([mockRoute, decision]) => decision === 'compared' && !routes.some(route => servedBy(mockRoute, route))).map(([mockRoute]) => mockRoute)

  expect(unexpected, 'what the mock answers that the CMS does not (fix the mock, or list it in KNOWN_DIFFERENCES with its reason)').toEqual([])
  expect(stale, 'known differences that no longer show (delete them from KNOWN_DIFFERENCES)').toEqual([])
  expect(unreached, 'mock routes marked as compared that no frontend request reached (add one to FRONTEND_REQUESTS)').toEqual([])
})
