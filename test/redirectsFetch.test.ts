import { createServer } from 'node:http'
import type { IncomingHttpHeaders, Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fetchRedirects } from '../server/lib/redirects'

// What `fetchRedirects` makes of each answer the plugin's route can give (docs/api.md, "Redirects")
let server: Server
let answer: { status: number, headers?: Record<string, string>, body?: unknown } = { status: 200 }
let received: { url: string, headers: IncomingHttpHeaders } | undefined
const config = { strapiUrl: '', strapiApiToken: 'the-token' }

beforeAll(async () => {
  server = createServer((request, response) => {
    received = { url: request.url ?? '', headers: request.headers }
    response.writeHead(answer.status, { 'Content-Type': 'application/json', ...answer.headers })
    response.end(answer.body === undefined ? undefined : JSON.stringify(answer.body))
  })
  await new Promise<void>(listening => server.listen(0, '127.0.0.1', listening))
  config.strapiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(() => {
  server.close()
})

describe('fetchRedirects', () => {
  it('reads the list and its tag, naming the site and the token', async () => {
    answer = { status: 200, headers: { ETag: '"tag-1"' }, body: { data: [{ from: '/a', to: '/b', locale: 'en' }] } }
    expect(await fetchRedirects(config, 'example', null)).toEqual({ status: 'changed', rows: [{ from: '/a', to: '/b', locale: 'en' }], etag: '"tag-1"' })
    expect(received?.url).toBe('/api/micelio/redirects?site=example')
    expect(received?.headers.authorization).toBe('Bearer the-token')
    expect(received?.headers['if-none-match']).toBeUndefined()
  })

  it('names no site when none is configured, and asks again with the tag', async () => {
    answer = { status: 304, headers: { ETag: '"tag-1"' } }
    expect(await fetchRedirects(config, '', '"tag-1"')).toEqual({ status: 'unchanged' })
    expect(received?.url).toBe('/api/micelio/redirects')
    expect(received?.headers['if-none-match']).toBe('"tag-1"')
  })

  it('resolves absent for a CMS without the route and forbidden for a token without the grant', async () => {
    answer = { status: 404 }
    expect(await fetchRedirects(config, '', null)).toEqual({ status: 'absent' })
    answer = { status: 403 }
    expect(await fetchRedirects(config, '', null)).toEqual({ status: 'forbidden' })
  })

  it('resolves unknownSite for the plugin\'s problem detail of a site it does not know, not absent', async () => {
    answer = { status: 404, body: { title: 'Not Found', status: 404, code: 'unknownSite' } }
    expect(await fetchRedirects(config, 'nope', null)).toEqual({ status: 'unknownSite' })
  })

  it('rejects on a failure and on an answer that is not the list', async () => {
    answer = { status: 500 }
    await expect(fetchRedirects(config, '', null)).rejects.toThrow()
    answer = { status: 200, body: { data: [{ from: '/a' }] } }
    await expect(fetchRedirects(config, '', null)).rejects.toThrow()
  })

  it('does not follow a redirect of the CMS', async () => {
    answer = { status: 302, headers: { Location: 'https://elsewhere.example/' } }
    await expect(fetchRedirects(config, '', null)).rejects.toThrow()
  })
})
