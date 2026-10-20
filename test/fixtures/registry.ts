import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { INDEX_MEDIA_TYPE, PACKAGE_MEDIA_TYPE } from '../../modules/theme/registry/constants'

// A registry on a loopback port, speaking just enough of the OCI distribution protocol for the client: manifests, blobs, an
// optional bearer-token challenge and a redirect of blobs to a second origin. It records every request it receives.

/** One request the fake registry received. */
export interface Seen {
  host: string
  path: string
  authorization: string | undefined
}

/** How the fake registry behaves. */
export interface RegistryBehaviour {
  /** Answer 401 with a bearer challenge until the request carries the token the registry hands out. */
  token?: boolean
  /** Serve blobs from a second server (another origin) through a 302. */
  redirectBlobs?: boolean
}

/** A running fake registry. */
export interface FakeRegistry {
  /** The value for `MICELIO_THEME_REGISTRY`. */
  registry: string
  seen: Seen[]
  /** Publishes `data` as `<name>:<tag>`, one layer of `mediaType`; returns the layer digest. */
  publish: (name: string, tag: string, data: Uint8Array, mediaType?: string) => string
  /** Publishes the index document. */
  publishIndex: (index: unknown) => string
  /** Replaces what a blob answers with, without changing its digest or its manifest. */
  tamper: (digest: string, data: Uint8Array) => void
  /** Makes a blob answer with `bytes` bytes in chunks and no length, and counts how many it managed to send. */
  endless: (digest: string, bytes: number) => { sent: () => number }
  /** Makes a request to this manifest or blob path answer with `status`. */
  fail: (path: string, status: number) => void
  /** Makes a blob answer a redirect to `location`. */
  redirect: (digest: string, location: string) => void
  close: () => Promise<void>
}

/** The `sha256:` digest of some bytes. */
export function digestOf(data: Uint8Array): string {
  return `sha256:${createHash('sha256').update(data).digest('hex')}`
}

function drained(response: ServerResponse): Promise<void> {
  return new Promise((resolve) => {
    const done = (): void => {
      response.off('drain', done)
      response.off('close', done)
      resolve()
    }
    response.once('drain', done)
    response.once('close', done)
  })
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port))
  })
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.closeAllConnections()
    server.close(() => resolve())
  })
}

/** Starts a fake registry under `prefix` (default `micelio-themes`). */
export async function startRegistry(behaviour: RegistryBehaviour = {}, prefix = 'micelio-themes'): Promise<FakeRegistry> {
  const manifests = new Map<string, string>()
  const blobs = new Map<string, Uint8Array>()
  const endlessBlobs = new Map<string, { bytes: number, sent: number }>()
  const failures = new Map<string, number>()
  const redirects = new Map<string, string>()
  const seen: Seen[] = []
  const TOKEN = 'test-token'

  async function serveBlob(request: IncomingMessage, response: ServerResponse, digest: string): Promise<void> {
    const endless = endlessBlobs.get(digest)
    if (endless) {
      response.writeHead(200, { 'content-type': 'application/octet-stream' })
      const chunk = Buffer.alloc(64 * 1024, 1)
      while (endless.sent < endless.bytes && !response.destroyed) {
        endless.sent += chunk.length
        if (!response.write(chunk)) await drained(response)
      }
      response.end()
      return
    }
    const data = blobs.get(digest)
    if (!data) {
      response.writeHead(404).end()
      return
    }
    response.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': data.length })
    response.end(data)
  }

  const storage = createServer((request, response) => {
    seen.push({ host: 'storage', path: request.url ?? '', authorization: request.headers.authorization })
    void serveBlob(request, response, (request.url ?? '').replace('/blob/', ''))
  })
  const server = createServer((request, response) => {
    const path = request.url ?? ''
    seen.push({ host: 'registry', path, authorization: request.headers.authorization })
    if (path.startsWith('/token')) {
      response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ token: TOKEN }))
      return
    }
    if (behaviour.token && request.headers.authorization !== `Bearer ${TOKEN}`) {
      response.writeHead(401, { 'www-authenticate': `Bearer realm="http://127.0.0.1:${(server.address() as AddressInfo).port}/token",service="fake"` }).end()
      return
    }
    const status = failures.get(path)
    if (status) {
      response.writeHead(status).end()
      return
    }
    const manifest = /^\/v2\/(.+)\/manifests\/([^/]+)$/.exec(path)
    if (manifest) {
      const body = manifests.get(`${manifest[1]}:${manifest[2]}`)
      if (body === undefined) response.writeHead(404).end()
      else response.writeHead(200, { 'content-type': 'application/vnd.oci.image.manifest.v1+json' }).end(body)
      return
    }
    const blob = /^\/v2\/.+\/blobs\/(sha256:[0-9a-f]{64})$/.exec(path)
    if (blob) {
      const digest = blob[1] as string
      const location = redirects.get(digest) ?? (behaviour.redirectBlobs ? `http://127.0.0.1:${(storage.address() as AddressInfo).port}/blob/${digest}` : undefined)
      if (location) response.writeHead(302, { location }).end()
      else void serveBlob(request, response, digest)
      return
    }
    response.writeHead(404).end()
  })

  const [port] = await Promise.all([listen(server), listen(storage)])

  function publish(name: string, tag: string, data: Uint8Array, mediaType = PACKAGE_MEDIA_TYPE): string {
    const digest = digestOf(data)
    blobs.set(digest, data)
    manifests.set(`${prefix}/${name}:${tag}`, JSON.stringify({
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      config: { mediaType: 'application/vnd.oci.empty.v1+json', digest: digestOf(Buffer.from('{}')), size: 2 },
      layers: [{ mediaType, digest, size: data.length }],
    }))
    return digest
  }

  return {
    registry: `127.0.0.1:${port}/${prefix}`,
    seen,
    publish,
    publishIndex: index => publish('index', 'v1', Buffer.from(JSON.stringify(index)), INDEX_MEDIA_TYPE),
    tamper: (digest, data) => blobs.set(digest, data),
    endless: (digest, bytes) => {
      const state = { bytes, sent: 0 }
      endlessBlobs.set(digest, state)
      return { sent: () => state.sent }
    },
    fail: (path, status) => failures.set(path, status),
    redirect: (digest, location) => redirects.set(digest, location),
    close: async () => {
      await Promise.all([closeServer(server), closeServer(storage)])
    },
  }
}
