import { afterEach, describe, expect, it, vi } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { strapiRequest } from '../server/lib/strapiRequest'

const config = { strapiUrl: 'https://cms.example.org/', strapiApiToken: 'api-token' }

function lastHeaders(fetchMock: ReturnType<typeof vi.fn>): Headers {
  const init = fetchMock.mock.calls.at(-1)![1] as { headers: HeadersInit }
  return new Headers(init.headers)
}

function stubFetch() {
  const fetchMock = vi.fn(async () => new Response('{}', { headers: { 'content-type': 'application/json' } }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe('strapiRequest credentials and headers', () => {
  it('sends the API token by default, plus the given headers', async () => {
    const fetchMock = stubFetch()
    await strapiRequest(config, '/api/x', { headers: { 'X-Micelio-Client-IP': '203.0.113.9' } })
    const headers = lastHeaders(fetchMock)
    expect(headers.get('authorization')).toBe('Bearer api-token')
    expect(headers.get('x-micelio-client-ip')).toBe('203.0.113.9')
  })

  it('sends no credential for anonymous calls and the JWT for user calls', async () => {
    const fetchMock = stubFetch()
    await strapiRequest(config, '/api/x', { auth: 'none' })
    expect(lastHeaders(fetchMock).get('authorization')).toBeNull()
    await strapiRequest(config, '/api/x', { auth: { jwt: 'user-jwt' } })
    expect(lastHeaders(fetchMock).get('authorization')).toBe('Bearer user-jwt')
  })

  it('does not let a header override or add a credential, in any auth mode', async () => {
    const fetchMock = stubFetch()
    await strapiRequest(config, '/api/x', { headers: { Authorization: 'Bearer other' } })
    expect(lastHeaders(fetchMock).get('authorization')).toBe('Bearer api-token')
    await strapiRequest(config, '/api/x', { auth: 'none', headers: { authorization: 'Bearer other' } })
    expect(lastHeaders(fetchMock).get('authorization')).toBeNull()
    await strapiRequest(config, '/api/x', { auth: { jwt: 'user-jwt' }, headers: { AUTHORIZATION: 'Bearer other' } })
    expect(lastHeaders(fetchMock).get('authorization')).toBe('Bearer user-jwt')
  })
})

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? sources(path) : path.endsWith('.ts') ? [path] : []
  })
}

describe('server calls to the CMS', () => {
  it('go through strapiFetch, so the visitor headers cannot be forgotten', () => {
    const offenders = sources('server')
      .filter(path => !path.endsWith(join('utils', 'strapi.ts')))
      .filter(path => /\$fetch\(\s*strapiUrl\(/.test(readFileSync(path, 'utf8')))
    expect(offenders).toEqual([])
  })

  it('pass the visitor request inside the options of every strapiFetch, except the documented cached ones', () => {
    const notVisitor = new Set([
      join('server', 'utils', 'site.ts'),
      join('server', 'utils', 'pageSections.ts'),
      join('server', 'utils', 'feed.ts'),
      join('server', 'routes', 'sitemap.xml.ts'),
    ])
    const offenders = sources('server')
      .filter(path => !notVisitor.has(path) && !path.startsWith(join('server', 'lib')) && !path.endsWith(join('utils', 'strapi.ts')))
      .flatMap(path => strapiFetchCalls(readFileSync(path, 'utf8')).filter(call => !/\bevent\b/.test(call)).map(call => `${path}: ${call.slice(0, 60)}`))
    expect(offenders).toEqual([])
  })
})

/** The text between the parentheses of each `strapiFetch(` call (strings with parentheses are not handled). */
function strapiFetchCalls(code: string): string[] {
  const calls: string[] = []
  for (const match of code.matchAll(/strapiFetch\b(?:<[^(]*?>)?\(/g)) {
    let depth = 1
    let end = match.index + match[0].length
    while (end < code.length && depth > 0) {
      if (code[end] === '(') depth++
      else if (code[end] === ')') depth--
      end++
    }
    calls.push(code.slice(match.index + match[0].length, end - 1))
  }
  return calls
}
