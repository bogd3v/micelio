import { createServer, type IncomingHttpHeaders } from 'node:http'
import type { AddressInfo } from 'node:net'

export interface UmamiRequest {
  method: string
  path: string
  headers: IncomingHttpHeaders
  body: string
}

interface MockUmamiResult {
  url: string
  requests: UmamiRequest[]
}

export const MOCK_TRACKER_SCRIPT = '/* umami tracker */'

/** Path a redirect from the mock points at; a request for it proves the proxy followed the redirect. */
export const MOCK_REDIRECT_TARGET = '/followed-redirect'

export async function startMockUmami(): Promise<MockUmamiResult> {
  const requests: UmamiRequest[] = []
  const server = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      requests.push({
        method: request.method ?? 'GET',
        path: request.url ?? '/',
        headers: request.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      })
      if (request.headers['x-mock-redirect']) {
        response.writeHead(302, { location: `http://${request.headers.host}${MOCK_REDIRECT_TARGET}` })
        response.end()
        return
      }
      if (request.method === 'GET') {
        response.writeHead(200, { 'content-type': 'application/javascript' })
        response.end(MOCK_TRACKER_SCRIPT)
        return
      }
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ ok: true }))
    })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return { url: `http://127.0.0.1:${port}`, requests }
}
