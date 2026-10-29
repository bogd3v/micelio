import { createHash } from 'node:crypto'
import { z } from 'zod'
import { RegistryError } from './error'

// A client of the OCI distribution protocol over HTTP with `fetch`: token, manifest, blob (ADR 0008, decision 4). The runtime image
// has only Node, so there is no ORAS binary. Every response is read with a byte cap while streaming; a redirect never carries credentials.

/** Redirects followed for one request; GHCR sends a blob to its storage host with one. */
const MAX_REDIRECTS = 3
/** Largest manifest or token response read. */
const MAX_SMALL_BYTES = 64 * 1024
/** Longest bearer token accepted. */
const MAX_TOKEN_LENGTH = 8 * 1024
const DEFAULT_TIMEOUT_MS = 30_000
const HOST = /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/
const COMPONENT = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/
const OCI_MANIFEST = 'application/vnd.oci.image.manifest.v1+json'
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308])
/** The error code GHCR's token service gives, with a 403, to an anonymous reader of a repository that does not exist or is not public. */
const DENIED = 'DENIED'

/** A registry address, split: the origin to call and the repository path every theme lives under. */
export interface RegistryLocation {
  origin: string
  /** For example `bogd3v/micelio-themes`. */
  prefix: string
}

/** A descriptor of a blob in a manifest. */
export interface OciDescriptor {
  mediaType: string
  /** `sha256:<hex>`. */
  digest: string
  size: number
}

/** The part of an OCI image manifest this client reads. */
export interface OciManifest {
  layers: OciDescriptor[]
}

/** The calls the rest of the registry code makes. */
export interface OciClient {
  /** The manifest at a tag of a repository under the registry's prefix. */
  manifest: (name: string, reference: string) => Promise<OciManifest>
  /** A blob, at most `maxBytes`, whose sha256 is checked against `digest` while it is read. */
  blob: (name: string, digest: string, maxBytes: number) => Promise<Buffer>
}

/** Options of `createOciClient`. */
export interface OciClientOptions {
  /** `host[:port]/path`, for example `ghcr.io/bogd3v/micelio-themes`. */
  registry: string
  /** The `fetch` to use; tests pass their own. */
  fetch?: typeof fetch
  /** Milliseconds one request may take, body included. */
  timeoutMs?: number
}

const Descriptor = z.object({
  mediaType: z.string().max(200),
  digest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  size: z.number().int().nonnegative(),
})
const Manifest = z.object({ schemaVersion: z.literal(2), layers: z.array(Descriptor).max(16) })

function isLoopback(host: string): boolean {
  return host === 'localhost' || host === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(host)
}

function isIpLiteral(host: string): boolean {
  return host.startsWith('[') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)
}

/**
 * Splits `host[:port]/path` into the origin to call and the repository prefix.
 *
 * @remarks
 * The scheme is never part of the setting: it is `https`, or `http` only for a loopback host (a local registry for development and tests).
 *
 * @throws `RegistryError` (`registry`) when the setting is not an address of that shape.
 */
export function parseRegistry(registry: string): RegistryLocation {
  const match = /^([^/:]+|\[::1\])(?::(\d{1,5}))?((?:\/[^/]+)+)$/.exec(registry)
  const host = match?.[1]
  const port = match?.[2]
  const parts = match?.[3]?.slice(1).split('/') ?? []
  if (!match || !host || registry.length > 256 || !(host === '[::1]' || HOST.test(host)) || (port !== undefined && (Number(port) < 1 || Number(port) > 65535)) || !parts.every(part => COMPONENT.test(part))) {
    throw new RegistryError('registry', 'MICELIO_THEME_REGISTRY must be host[:port]/path in lowercase, for example ghcr.io/bogd3v/micelio-themes')
  }
  return { origin: `${isLoopback(host) ? 'http' : 'https'}://${host}${port === undefined ? '' : `:${port}`}`, prefix: parts.join('/') }
}

/** Parses `Bearer realm="…",service="…"` into its parameters. */
function challenge(header: string | null): Record<string, string> | null {
  if (!header || !/^bearer\s/i.test(header)) return null
  const params: Record<string, string> = {}
  for (const match of header.matchAll(/([a-z]+)="([^"]*)"/gi)) params[(match[1] as string).toLowerCase()] = match[2] as string
  return params
}

/**
 * Creates a client for one registry.
 *
 * @remarks
 * A request is anonymous first and authenticates only when the registry answers 401 with a bearer challenge: the token is asked
 * for the `pull` scope of the repository being read, never for the scope the registry names. A redirect (or a token realm) must
 * be `https` (or loopback `http` when the registry itself is) and, if it is an IP address, the registry's own; `Authorization`
 * is dropped when a redirect changes origin. Each body is read with a byte cap while streaming, and the whole request, body
 * included, has a timeout. The registry is read anonymously by every site, so a token service that answers 403 `DENIED` (GHCR's
 * answer for a repository nobody has pushed, or that is not public) means the repository is not there for this reader: `not-found`.
 *
 * @throws `RegistryError` (`registry`) from this function when the address is invalid. The returned calls throw `RegistryError`
 * (`network`, `size`, `digest`, `not-found`, `registry`).
 */
export function createOciClient(options: OciClientOptions): OciClient {
  const { origin, prefix } = parseRegistry(options.registry)
  const registryHost = new URL(origin).host
  const doFetch = options.fetch ?? fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const tokens = new Map<string, string>()

  function allowed(url: URL, what: string): void {
    // a local registry (loopback, http) may send a client to another loopback port; nothing else may use http or an IP address
    const local = isLoopback(new URL(origin).hostname) && isLoopback(url.hostname)
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new RegistryError('registry', `${what} is not https`)
    if (url.username || url.password) throw new RegistryError('registry', `${what} carries credentials`)
    if (isIpLiteral(url.hostname) && url.host !== registryHost && !local) throw new RegistryError('registry', `${what} is an IP address other than the registry's`)
    // names that only mean something inside a network, and ports other than 443, are for the registry itself or a local one
    if (url.host !== registryHost && !local) {
      if (!url.hostname.includes('.') || /\.(local|localhost|internal|lan|home|corp)$/.test(url.hostname)) throw new RegistryError('registry', `${what} is a host name that is not public`)
      if (url.port !== '') throw new RegistryError('registry', `${what} uses a port other than 443`)
    }
  }

  async function send(url: URL, headers: Headers, signal: AbortSignal, redirects = false): Promise<Response> {
    let current = url
    let sent = headers
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const response = await doFetch(current, { headers: sent, redirect: 'manual', signal })
      if (!REDIRECT_STATUS.has(response.status)) return response
      if (!redirects) throw new RegistryError('registry', `answered ${response.status}: only a blob may be redirected`)
      const location = response.headers.get('location')
      await response.body?.cancel()
      if (!location) throw new RegistryError('registry', `answered ${response.status} without a location`)
      const next = new URL(location, current)
      allowed(next, 'a redirect')
      if (next.origin !== current.origin) {
        sent = new Headers(sent)
        sent.delete('authorization')
      }
      current = next
    }
    throw new RegistryError('registry', `redirected more than ${MAX_REDIRECTS} times`)
  }

  async function readCapped(response: Response, maxBytes: number, onChunk?: (chunk: Uint8Array) => void): Promise<Buffer> {
    const declared = Number(response.headers.get('content-length'))
    if (Number.isFinite(declared) && declared > maxBytes) {
      await response.body?.cancel()
      throw new RegistryError('size', `the response declares ${declared} bytes; the limit is ${maxBytes}`)
    }
    const chunks: Uint8Array[] = []
    let total = 0
    const reader = response.body?.getReader()
    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.length
      if (total > maxBytes) {
        await reader.cancel()
        throw new RegistryError('size', `the response is longer than the limit of ${maxBytes} bytes`)
      }
      onChunk?.(value)
      chunks.push(value)
    }
    return Buffer.concat(chunks)
  }

  /** Whether a token service answer is `{"errors":[{"code":"DENIED",…}]}`; any other body, or one that is not JSON, is not. */
  async function isDenied(response: Response): Promise<boolean> {
    try {
      const body = JSON.parse((await readCapped(response, MAX_SMALL_BYTES)).toString('utf8')) as { errors?: unknown }
      return Array.isArray(body.errors) && body.errors.some(item => typeof item === 'object' && item !== null && (item as { code?: unknown }).code === DENIED)
    } catch (error) {
      if (error instanceof RegistryError) throw error
      return false
    }
  }

  async function token(info: Record<string, string>, repository: string, signal: AbortSignal): Promise<string> {
    const realm = new URL(info.realm ?? '', origin)
    allowed(realm, 'the token realm')
    if (realm.host !== registryHost) throw new RegistryError('registry', 'the token realm is not the registry itself')
    realm.searchParams.set('service', info.service ?? registryHost)
    realm.searchParams.set('scope', `repository:${repository}:pull`)
    const response = await send(realm, new Headers({ 'accept': 'application/json', 'accept-encoding': 'identity' }), signal)
    if (response.status === 403 && (await isDenied(response))) throw new RegistryError('not-found', `${repository} is not in the registry or is not public`)
    if (!response.ok) throw new RegistryError('registry', `the token service answered ${response.status}`)
    const body = JSON.parse((await readCapped(response, MAX_SMALL_BYTES)).toString('utf8')) as { token?: unknown, access_token?: unknown }
    const value = body.token ?? body.access_token
    if (typeof value !== 'string' || value === '' || value.length > MAX_TOKEN_LENGTH || /[\s]/.test(value)) throw new RegistryError('registry', 'the token service returned no usable token')
    return value
  }

  async function get(name: string, path: string, accept: string, maxBytes: number, onChunk?: (chunk: Uint8Array) => void): Promise<Buffer> {
    const repository = `${prefix}/${name}`
    const url = new URL(`/v2/${repository}/${path}`, origin)
    const signal = AbortSignal.timeout(timeoutMs)
    try {
      const headers = (bearer?: string): Headers => new Headers({ 'accept': accept, 'accept-encoding': 'identity', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) })
      let response = await send(url, headers(tokens.get(repository)), signal, path.startsWith('blobs/'))
      const info = response.status === 401 ? challenge(response.headers.get('www-authenticate')) : null
      if (info) {
        await response.body?.cancel()
        tokens.set(repository, await token(info, repository, signal))
        response = await send(url, headers(tokens.get(repository)), signal, path.startsWith('blobs/'))
      }
      if (response.status === 404) {
        await response.body?.cancel()
        throw new RegistryError('not-found', `${repository}/${path} is not in the registry`)
      }
      if (!response.ok) {
        await response.body?.cancel()
        throw new RegistryError('registry', `${repository}/${path} answered ${response.status}`)
      }
      return await readCapped(response, maxBytes, onChunk)
    } catch (error) {
      if (error instanceof RegistryError) throw error
      throw new RegistryError('network', `${repository}/${path}: ${(error as Error).message}`, {}, { cause: error })
    }
  }

  return {
    async manifest(name, reference) {
      const body = await get(name, `manifests/${reference}`, OCI_MANIFEST, MAX_SMALL_BYTES)
      let value: unknown
      try {
        value = JSON.parse(body.toString('utf8'))
      } catch (error) {
        throw new RegistryError('registry', `${name}:${reference} is not a JSON manifest`, {}, { cause: error })
      }
      const parsed = Manifest.safeParse(value)
      if (!parsed.success) throw new RegistryError('registry', `${name}:${reference} is not an OCI image manifest`)
      return { layers: parsed.data.layers }
    },
    async blob(name, digest, maxBytes) {
      const hash = createHash('sha256')
      const data = await get(name, `blobs/${digest}`, 'application/octet-stream', maxBytes, chunk => hash.update(chunk))
      const actual = `sha256:${hash.digest('hex')}`
      if (actual !== digest) throw new RegistryError('digest', `the blob is ${actual}, not ${digest}`, { id: name, digest })
      return data
    },
  }
}
