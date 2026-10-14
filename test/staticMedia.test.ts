import { createServer } from 'node:http'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { fetchMedia } from '../modules/lib/static-media'

let server: Server | undefined

async function serve(handler: Parameters<typeof createServer>[1]): Promise<string> {
  server = createServer(handler)
  await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

afterEach(async () => {
  await new Promise<void>(resolve => (server ? server.close(() => resolve()) : resolve()))
  server = undefined
})

describe('fetchMedia', () => {
  it('downloads a file the host serves directly', async () => {
    const origin = await serve((_request, response) => response.writeHead(200, { 'content-type': 'image/png' }).end('png'))
    const blob = await fetchMedia(`${origin}/a.png`)
    expect(blob.type).toBe('image/png')
    expect(await blob.text()).toBe('png')
  })

  it('refuses a host that redirects and names the URL', async () => {
    const target = await serve((_request, response) => response.writeHead(200, { 'content-type': 'image/png' }).end('png'))
    const targetServer = server!
    server = undefined
    const origin = await serve((_request, response) => response.writeHead(302, { location: `${target}/b.png` }).end())
    try {
      await expect(fetchMedia(`${origin}/a.png`)).rejects.toThrow(`Could not download ${origin}/a.png`)
    } finally {
      await new Promise<void>(resolve => targetServer.close(() => resolve()))
    }
  })
})
