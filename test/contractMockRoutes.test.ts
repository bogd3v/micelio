import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { KNOWN_DIFFERENCES, MOCK_ROUTES, routeOf, servedBy } from '../e2e/contract/mock-shape'

// Every route the mock Strapi serves must be decided in e2e/contract/mock-shape.ts: compared with the real CMS, or not with the reason
function mockRoutes(): string[] {
  const source = readFileSync('e2e/mock-strapi.mjs', 'utf8')
  const found = [...source.matchAll(/method === '(\w+)' && url\.pathname ?(===|\.startsWith\() ?'([^']+)'/g)]
  return found.map(([, method, operator, path]) => `${method} ${path}${operator === '===' ? '' : '*'}`)
}

describe('the mock routes of the contract check', () => {
  it('finds the routes in the mock', () => {
    expect(mockRoutes()).toContain('GET /api/articles')
    expect(mockRoutes()).toContain('GET /api/comments*')
  })

  it('decides every route the mock serves', () => {
    expect(mockRoutes().filter(route => !(route in MOCK_ROUTES))).toEqual([])
  })

  it('lists no route the mock does not serve', () => {
    expect(Object.keys(MOCK_ROUTES).filter(route => !mockRoutes().includes(route))).toEqual([])
  })

  it('gives a reason for every route that is not compared', () => {
    for (const [route, decision] of Object.entries(MOCK_ROUTES)) expect(decision, route).not.toBe('')
  })
})

describe('routeOf', () => {
  it('makes the relation of a comment route generic and drops the query', () => {
    expect(routeOf('/api/comments/api::article.article:abc123?locale=en')).toBe('/api/comments/:relation')
    expect(routeOf('/api/comments/api::article.article:abc123/flat?locale=en&page=1')).toBe('/api/comments/:relation/flat')
    expect(routeOf('/api/articles?populate%5Bcover%5D=%2A')).toBe('/api/articles')
  })
})

describe('servedBy', () => {
  it('matches a route exactly, or by prefix when the mock route ends with *', () => {
    expect(servedBy('GET /api/articles', '/api/articles')).toBe(true)
    expect(servedBy('GET /api/articles', '/api/articles/search')).toBe(false)
    expect(servedBy('GET /api/comments*', '/api/comments/:relation/flat')).toBe(true)
  })
})

describe('the known differences', () => {
  it('each has a reason and a message of the shape check', () => {
    for (const difference of KNOWN_DIFFERENCES) {
      expect(difference.reason.length, difference.issue).toBeGreaterThan(10)
      expect(difference.issue).toMatch(/^\$/)
    }
  })

  it('lists none twice', () => {
    const keys = KNOWN_DIFFERENCES.map(difference => `${difference.route} ${difference.issue}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
