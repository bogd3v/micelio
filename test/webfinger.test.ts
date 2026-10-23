import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { forwardWebFinger } from '../server/lib/webfinger'

const LIMITS = { timeoutMs: 1000, maxBytes: 1024 }

let server: Server
let base: string
let lastUrl = ''
let lastHeaders: IncomingMessage['headers'] = {}

function handle(req: IncomingMessage, res: ServerResponse): void {
  lastUrl = req.url ?? ''
  lastHeaders = req.headers
  const path = new URL(req.url ?? '/', 'http://localhost').pathname
  if (path === '/jrd') {
    res.writeHead(200, { 'Content-Type': 'application/jrd+json' })
    res.end('{"subject":"acct:blog@example.com"}')
  } else if (path === '/gone') {
    res.writeHead(410)
    res.end()
  } else if (path === '/slow') {
    setTimeout(() => res.end('late'), 3000)
  } else if (path === '/declared-big') {
    res.writeHead(200, { 'Content-Length': '4096' })
    res.end('x'.repeat(4096))
  } else if (path === '/streamed-big') {
    // No Content-Length: the cap has to stop the read itself
    res.writeHead(200, { 'Content-Type': 'application/jrd+json' })
    res.write('x'.repeat(800))
    res.end('x'.repeat(800))
  } else if (path === '/redirect') {
    res.writeHead(301, { Location: 'https://elsewhere.test/' })
    res.end()
  }
}

beforeAll(async () => {
  server = createServer(handle)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(() => {
  server.closeAllConnections()
  server.close()
})

describe('forwardWebFinger', () => {
  it('answers the status, Content-Type and body of the CMS, sending only resource', async () => {
    const answer = await forwardWebFinger(`${base}/jrd`, 'acct:blog@example.com', LIMITS)
    expect(answer).toMatchObject({ status: 200, contentType: 'application/jrd+json' })
    expect(new TextDecoder().decode((answer as { body: Uint8Array }).body)).toBe('{"subject":"acct:blog@example.com"}')
    expect(lastUrl).toBe('/jrd?resource=acct%3Ablog%40example.com')
    expect(lastHeaders.authorization).toBeUndefined()
    expect(lastHeaders.cookie).toBeUndefined()
  })

  it('sends no resource when there is none, and passes an error status with no body on', async () => {
    expect(await forwardWebFinger(`${base}/gone`, undefined, LIMITS)).toEqual({ status: 410, body: new Uint8Array() })
    expect(lastUrl).toBe('/gone')
  })

  it('answers timeout when the CMS does not answer in time', async () => {
    expect(await forwardWebFinger(`${base}/slow`, 'acct:blog@example.com', { ...LIMITS, timeoutMs: 100 })).toBe('timeout')
  })

  it('answers unavailable for a body over the cap, declared or streamed', async () => {
    expect(await forwardWebFinger(`${base}/declared-big`, 'acct:blog@example.com', LIMITS)).toBe('unavailable')
    expect(await forwardWebFinger(`${base}/streamed-big`, 'acct:blog@example.com', LIMITS)).toBe('unavailable')
  })

  it('answers unavailable for a redirect instead of following it', async () => {
    expect(await forwardWebFinger(`${base}/redirect`, 'acct:blog@example.com', LIMITS)).toBe('unavailable')
  })

  it('answers unavailable when the CMS cannot be reached', async () => {
    const closed = createServer()
    await new Promise<void>(resolve => closed.listen(0, '127.0.0.1', resolve))
    const port = (closed.address() as AddressInfo).port
    await new Promise<void>(resolve => closed.close(() => resolve()))
    expect(await forwardWebFinger(`http://127.0.0.1:${port}/jrd`, 'acct:blog@example.com', LIMITS)).toBe('unavailable')
  })
})
