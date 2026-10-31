import { afterEach, describe, expect, it } from 'vitest'
import { createRegistry } from '../modules/theme/registry/client'
import { MAX_COMPRESSED_BYTES, PACKAGE_MEDIA_TYPE } from '../modules/theme/registry/constants'
import { RegistryError } from '../modules/theme/registry/error'
import { parseRegistry } from '../modules/theme/registry/oci'
import { parseIndex } from '../modules/theme/registry/registry-index'
import { unpackTheme } from '../modules/theme/registry/unpack'
import { digestOf, startRegistry, stubBundle, stubVerifier, TEST_IDENTITY } from './fixtures/registry'
import type { FakeRegistry, RegistryBehaviour } from './fixtures/registry'
import { noise, packageOf } from './fixtures/tar'

const started: FakeRegistry[] = []

async function start(behaviour?: RegistryBehaviour): Promise<FakeRegistry> {
  const fake = await startRegistry(behaviour)
  started.push(fake)
  return fake
}

afterEach(async () => {
  await Promise.all(started.splice(0).map(fake => fake.close()))
})

/** A client of a fake registry that checks stand-in bundles against the test identity. */
function create(fake: FakeRegistry, extra: Partial<Parameters<typeof createRegistry>[0]> = {}): ReturnType<typeof createRegistry> {
  return createRegistry({ registry: fake.registry, identity: TEST_IDENTITY, verifier: stubVerifier, ...extra })
}

async function failure(run: () => Promise<unknown>): Promise<RegistryError> {
  try {
    await run()
  } catch (error) {
    if (error instanceof RegistryError) return error
    throw error
  }
  throw new Error('expected a RegistryError')
}

function entry(digest: string, fields: Record<string, unknown> = {}): Record<string, unknown> {
  return { digest, contract: '2.0', license: 'MIT', tier: 'official', distribution: 'public', status: 'published', code: false, ...fields }
}

const BODY = packageOf({ 'theme.css': 'a{}' })
const BODY_DIGEST = digestOf(BODY)

/** A registry with `sample` 1.0.0 published and indexed. */
async function withSample(behaviour?: RegistryBehaviour, extra: Record<string, unknown> = {}): Promise<FakeRegistry> {
  const fake = await start(behaviour)
  fake.publish('sample', '1.0.0', BODY)
  fake.publishIndex({ version: 1, themes: { sample: { versions: { '1.0.0': entry(BODY_DIGEST), ...extra } } } })
  return fake
}

describe('the registry address', () => {
  it('splits host, port and path, and uses http only for loopback', () => {
    expect(parseRegistry('ghcr.io/bogd3v/micelio-themes')).toEqual({ origin: 'https://ghcr.io', prefix: 'bogd3v/micelio-themes' })
    expect(parseRegistry('registry.example.com:8443/themes')).toEqual({ origin: 'https://registry.example.com:8443', prefix: 'themes' })
    expect(parseRegistry('localhost:5000/themes')).toEqual({ origin: 'http://localhost:5000', prefix: 'themes' })
    expect(parseRegistry('127.0.0.1:5000/a/b')).toEqual({ origin: 'http://127.0.0.1:5000', prefix: 'a/b' })
  })

  it.each([
    'ghcr.io', 'https://ghcr.io/x', 'GHCR.io/x', 'ghcr.io/X', 'ghcr.io//x', 'ghcr.io/x/', 'ghcr.io/../x', 'ghcr.io:0/x', 'ghcr.io:99999/x',
    'user@ghcr.io/x', 'ghcr.io/x y', 'ghcr.io/x?y', '', `ghcr.io/${'a'.repeat(300)}`, 'ghcr.io/x@sha256:abc',
  ])('refuses %j', async (registry) => {
    expect((await failure(async () => createRegistry({ registry, identity: null }))).failure).toBe('registry')
  })
})

describe('resolving a theme', () => {
  it('picks the highest published version that satisfies the range, skipping yanked and incompatible ones', async () => {
    const digest = (n: string): string => digestOf(Buffer.from(n))
    const fake = await start()
    fake.publishIndex({
      version: 1,
      themes: {
        sample: {
          versions: {
            '1.0.0': entry(digest('a')),
            '1.1.0': entry(digest('b')),
            '1.2.0': entry(digest('c'), { status: 'yanked' }),
            '1.3.0': entry(digest('d'), { status: 'incompatible' }),
            '1.4.0': entry(digest('e'), { contract: '2.1' }),
            '1.5.0': entry(digest('f'), { contract: '3.0' }),
            '1.6.0-rc.1': entry(digest('g')),
            '2.0.0': entry(digest('h'), { tier: 'verified', code: true }),
          },
        },
      },
    })
    const registry = create(fake)
    expect(await registry.resolve('sample', '^1.0.0')).toMatchObject({ id: 'sample', version: '1.1.0', digest: digest('b'), tier: 'official', registry: fake.registry })
    expect(await registry.resolve('sample')).toMatchObject({ version: '2.0.0', tier: 'verified', code: true, contract: '2.0', distribution: 'public' })
    expect(await registry.resolve('sample', '1.0.0')).toMatchObject({ version: '1.0.0' })
    expect((await failure(() => registry.resolve('sample', '1.2.0'))).failure).toBe('not-found')
    expect((await failure(() => registry.resolve('sample', '3'))).failure).toBe('not-found')
    expect((await failure(() => registry.resolve('other'))).failure).toBe('not-found')
  })

  it('lists the newer versions this core can install, highest first', async () => {
    const fake = await start()
    const d = (n: string): string => digestOf(Buffer.from(n))
    fake.publishIndex({ version: 1, themes: { sample: { versions: { '1.0.0': entry(d('a')), '1.1.0': entry(d('b')), '1.2.0': entry(d('c'), { status: 'yanked' }), '1.3.0': entry(d('d')), '2.0.0': entry(d('e'), { contract: '3.0' }) } } } })
    expect(await create(fake).newer('sample', '1.0.0')).toEqual(['1.3.0', '1.1.0'])
  })

  it('refuses a licensed theme and the id of the index', async () => {
    const fake = await start()
    fake.publishIndex({ version: 1, themes: { paid: { versions: { '1.0.0': entry(digestOf(Buffer.from('p')), { distribution: 'licensed' }) } } } })
    const registry = create(fake)
    expect((await failure(() => registry.resolve('paid'))).failure).toBe('unsupported')
    expect((await failure(() => registry.resolve('index'))).failure).toBe('pin')
    expect((await failure(() => registry.resolve('../x'))).failure).toBe('pin')
  })

  it('reads the index once per client and tries again after a failure', async () => {
    const fake = await withSample()
    const registry = create(fake)
    await registry.resolve('sample')
    await registry.resolve('sample', '1')
    expect(fake.seen.filter(request => request.path.includes('/index/manifests/v1')).length).toBe(2)
    expect(fake.seen.filter(request => request.path.endsWith('/index/manifests/v1')).length).toBe(1)

    const down = await start()
    const client = create(down)
    expect((await failure(() => client.resolve('sample'))).failure).toBe('not-found')
    down.publishIndex({ version: 1, themes: { sample: { versions: { '1.0.0': entry(BODY_DIGEST) } } } })
    expect((await client.resolve('sample')).version).toBe('1.0.0')
  })

  it('refuses an index that does not validate, and does not use part of it', () => {
    const good = { versions: { '1.0.0': entry(BODY_DIGEST) } }
    expect(parseIndex(JSON.stringify({ version: 1, themes: { sample: good } })).themes.sample).toBeDefined()
    for (const bad of [
      '{', '[]', '{"version":2,"themes":{}}',
      JSON.stringify({ version: 1, themes: { Bad_Id: good } }),
      JSON.stringify({ version: 1, themes: { sample: { versions: { '^1.0.0': entry(BODY_DIGEST) } } } }),
      JSON.stringify({ version: 1, themes: { sample: { versions: { '1.0.0': entry('sha256:x') } } } }),
      JSON.stringify({ version: 1, themes: { sample: { versions: { '1.0.0': entry(BODY_DIGEST, { status: 'gone' }) } } } }),
      '{"version":1,"themes":{"__proto__":{"versions":{}}}}',
      '{"version":1,"themes":{"sample":{"versions":{"__proto__":{}}}}}',
    ]) {
      expect(() => parseIndex(bad), bad.slice(0, 60)).toThrow(RegistryError)
    }
  })
})

/** Lists `sample@1.0.0` with this digest in a signed index. */
function list(fake: FakeRegistry, digest: string, fields: Record<string, unknown> = {}): void {
  fake.publishIndex({ version: 1, themes: { sample: { versions: { '1.0.0': entry(digest, fields) } } } })
}

describe('what the index says about a pin', () => {
  it('gives the entry of the exact version and digest, and nothing for another digest, another version or an unknown theme', async () => {
    const fake = await withSample(undefined, { '1.1.0': entry(digestOf(Buffer.from('b')), { tier: 'community', status: 'yanked', code: true }) })
    const client = create(fake)
    expect(await client.listed({ id: 'sample', version: '1.0.0', digest: BODY_DIGEST })).toMatchObject({ digest: BODY_DIGEST, tier: 'official', status: 'published', code: false })
    expect(await client.listed({ id: 'sample', version: '1.1.0', digest: digestOf(Buffer.from('b')) })).toMatchObject({ tier: 'community', status: 'yanked', code: true })
    expect(await client.listed({ id: 'sample', version: '1.0.0', digest: digestOf(Buffer.from('other')) })).toBeUndefined()
    expect(await client.listed({ id: 'sample', version: '9.9.9', digest: BODY_DIGEST })).toBeUndefined()
    expect(await client.listed({ id: 'constructor', version: '1.0.0', digest: BODY_DIGEST })).toBeUndefined()
  })

  it('reads nothing without a signer identity and refuses an index that is not signed by it', async () => {
    const fake = await withSample()
    expect((await failure(() => create(fake, { identity: null }).listed({ id: 'sample', version: '1.0.0', digest: BODY_DIGEST }))).failure).toBe('signer')
    expect(fake.seen).toEqual([])
    const unsigned = await start()
    unsigned.publishIndex({ version: 1, themes: {} }, false)
    expect((await failure(() => create(unsigned).listed({ id: 'sample', version: '1.0.0', digest: BODY_DIGEST }))).failure).toBe('not-found')
  })
})

describe('pulling a package', () => {
  const pin = { id: 'sample', version: '1.0.0', digest: BODY_DIGEST }

  it('downloads it anonymously over HTTP, with no credentials and no ORAS, and returns its attestation', async () => {
    const fake = await withSample()
    const { data, bundle } = await create(fake).fetch(pin)
    expect(digestOf(data)).toBe(BODY_DIGEST)
    expect(bundle.toString('utf8')).toContain(TEST_IDENTITY.packages)
    expect(fake.seen.every(request => request.authorization === undefined)).toBe(true)
    expect(unpackTheme(data, { digest: BODY_DIGEST }).files.get('theme.css')?.length).toBe(3)
  })

  it('asks for a token when the registry challenges, for the repository it reads, and sends it', async () => {
    const fake = await withSample({ token: true })
    await create(fake).fetch(pin)
    const scopes = fake.seen.filter(request => request.path.startsWith('/token')).map(request => request.path)
    expect(scopes.some(path => path.includes('scope=repository%3Amicelio-themes%2Fsample%3Apull'))).toBe(true)
    expect(scopes.every(path => path.endsWith('%3Apull'))).toBe(true)
    expect(fake.seen.filter(request => request.authorization === 'Bearer test-token').length).toBeGreaterThanOrEqual(2)
  })

  it('follows a redirect to the storage origin without sending the token there', async () => {
    const fake = await withSample({ token: true, redirectBlobs: true })
    const { data } = await create(fake).fetch(pin)
    expect(digestOf(data)).toBe(BODY_DIGEST)
    const storage = fake.seen.filter(request => request.host === 'storage')
    expect(storage.length).toBeGreaterThanOrEqual(1)
    expect(storage.every(request => request.authorization === undefined)).toBe(true)
  })

  it.each([
    ['a scheme that is not http', 'ftp://example.test/x'],
    ['http to a host that is not loopback', 'http://example.test/x'],
    ['credentials in the URL', 'http://user:pass@127.0.0.1/x'],
    ['an IP address that is not loopback', 'http://10.0.0.1/x'],
    ['an https IP address', 'https://10.0.0.1/x'],
    ['a name that is not public', 'https://intranet/x'],
    ['an internal name', 'https://storage.internal/x'],
    ['another port', 'https://storage.example.test:8443/x'],
  ])('refuses a redirect to %s', async (_name, location) => {
    const fake = await withSample()
    fake.redirect(BODY_DIGEST, location)
    const error = await failure(() => create(fake).fetch(pin))
    expect(error.failure).toBe('registry')
    expect(error.message).toContain('sample@1.0.0')
    expect(error.message).toContain(BODY_DIGEST)
  })

  it('stops following redirects after three', async () => {
    const fake = await withSample()
    fake.redirect(BODY_DIGEST, `http://${fake.registry.split('/')[0]}/v2/micelio-themes/sample/blobs/${BODY_DIGEST}`)
    expect((await failure(() => create(fake).fetch(pin))).message).toContain('redirected more than')
  })

  it('refuses a version whose manifest names another digest than the pin', async () => {
    const fake = await withSample()
    const other = `sha256:${'b'.repeat(64)}`
    list(fake, other)
    const error = await failure(() => create(fake).fetch({ ...pin, digest: other }))
    expect(error.failure).toBe('digest')
    expect(error.message).toContain(BODY_DIGEST)
  })

  it('refuses bytes that do not hash to the digest', async () => {
    const fake = await withSample()
    fake.tamper(BODY_DIGEST, Buffer.from('other bytes'))
    expect((await failure(() => create(fake).fetch(pin))).failure).toBe('digest')
  })

  it('refuses a package larger than 2 MiB from its manifest, before downloading it', async () => {
    const fake = await start()
    const big = noise(MAX_COMPRESSED_BYTES + 1)
    list(fake, fake.publish('sample', '1.0.0', big))
    const error = await failure(() => create(fake).fetch({ ...pin, digest: digestOf(big) }))
    expect(error.failure).toBe('size')
    expect(fake.seen.some(request => request.path.includes('/sample/blobs/'))).toBe(false)
  })

  it('stops reading a stream that has no length at 2 MiB', async () => {
    const fake = await start()
    const digest = fake.publish('sample', '1.0.0', Buffer.from('x'))
    list(fake, digest)
    const endless = fake.endless(digest, 64 * 1024 * 1024)
    const error = await failure(() => create(fake).fetch({ ...pin, digest }))
    expect(error.failure).toBe('size')
    expect(endless.sent()).toBeLessThan(MAX_COMPRESSED_BYTES + 8 * 1024 * 1024)
    expect(endless.sent()).toBeLessThan(64 * 1024 * 1024)
  })

  it('refuses a manifest that is not one package layer', async () => {
    const fake = await start()
    list(fake, fake.publish('sample', '1.0.0', BODY, 'application/octet-stream'))
    expect((await failure(() => create(fake).fetch(pin))).message).toContain(PACKAGE_MEDIA_TYPE)
  })

  it('tells a missing version from a registry error and from a network failure', async () => {
    const fake = await withSample()
    const registry = create(fake)
    expect((await failure(() => registry.fetch({ ...pin, version: '1.0.1' }))).failure).toBe('listing')
    fake.fail('/v2/micelio-themes/sample/manifests/1.0.0', 500)
    expect((await failure(() => registry.fetch(pin))).failure).toBe('registry')
    fake.fail('/v2/micelio-themes/sample/manifests/1.0.0', 404)
    expect((await failure(() => registry.fetch(pin))).failure).toBe('not-found')
    await fake.close()
    expect((await failure(() => registry.fetch(pin))).failure).toBe('network')
  })

  it('gives up on a request that never answers', async () => {
    const hang: typeof fetch = (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('timed out')))
    })
    const error = await failure(() => createRegistry({ registry: 'registry.example.test/themes', identity: TEST_IDENTITY, verifier: stubVerifier, fetch: hang, timeoutMs: 20 }).fetch(pin))
    expect(error.failure).toBe('network')
  })

  it('checks the pin before it makes a request', async () => {
    const fake = await withSample()
    const registry = create(fake)
    for (const bad of [{ ...pin, id: '../x' }, { ...pin, version: '^1.0.0' }, { ...pin, digest: 'sha256:x' }, { ...pin, id: 'index' }]) {
      expect((await failure(() => registry.fetch(bad))).failure).toBe('pin')
    }
    expect(fake.seen).toEqual([])
  })
})

describe('where a registry may send the client', () => {
  const pin = { id: 'sample', version: '1.0.0', digest: BODY_DIGEST }

  function answering(respond: (url: string) => Response): typeof fetch {
    return input => Promise.resolve(respond(String(input)))
  }

  it('asks for a token only from the registry itself', async () => {
    const stub = answering(() => new Response(null, { status: 401, headers: { 'www-authenticate': 'Bearer realm="https://auth.example.test/token",service="x"' } }))
    const registry = createRegistry({ registry: 'registry.example.test/themes', identity: TEST_IDENTITY, verifier: stubVerifier, fetch: stub })
    const error = await failure(() => registry.resolve('sample'))
    expect(error.failure).toBe('registry')
    expect(error.message).toContain('token realm')
  })

  it('does not follow a redirect for anything but a blob', async () => {
    const stub = answering(() => new Response(null, { status: 302, headers: { location: 'https://elsewhere.example.test/x' } }))
    const registry = createRegistry({ registry: 'registry.example.test/themes', identity: TEST_IDENTITY, verifier: stubVerifier, fetch: stub })
    expect((await failure(() => registry.fetch(pin))).message).toContain('only a blob may be redirected')
  })

  it('does not find a theme by a name of the object prototype', async () => {
    const fake = await withSample()
    const registry = create(fake)
    expect((await failure(() => registry.resolve('constructor'))).failure).toBe('not-found')
    expect((await failure(() => registry.fetch({ ...pin, id: 'constructor' }))).failure).toBe('listing')
    expect((await failure(() => registry.fetch({ ...pin, version: '1.0.0-toString' }))).failure).toBe('listing')
  })

  it('refuses an index with a version that would take the tag of an attestation', () => {
    const text = JSON.stringify({ version: 1, themes: { sample: { versions: { '1.0.0-x.att': entry(BODY_DIGEST) } } } })
    expect(() => parseIndex(text)).toThrow(RegistryError)
  })
})

describe('what the registry must prove', () => {
  const pin = { id: 'sample', version: '1.0.0', digest: BODY_DIGEST }

  it('refuses a digest the index does not list, or lists for another version', async () => {
    const fake = await withSample()
    expect((await failure(() => create(fake).fetch({ ...pin, digest: `sha256:${'c'.repeat(64)}` }))).failure).toBe('listing')
    expect((await failure(() => create(fake).fetch({ ...pin, id: 'other' }))).failure).toBe('listing')
  })

  it('refuses a yanked or incompatible version, unless the digest is the site\'s own pin', async () => {
    for (const status of ['yanked', 'incompatible']) {
      const fake = await start()
      list(fake, fake.publish('sample', '1.0.0', BODY), { status })
      expect((await failure(() => create(fake).fetch(pin))).failure).toBe('listing')
      expect(digestOf((await create(fake).fetch(pin, { locked: true })).data)).toBe(BODY_DIGEST)
    }
  })

  it('refuses an index that is not signed, or signed by the identity of the packages', async () => {
    const unsigned = await start()
    unsigned.publish('sample', '1.0.0', BODY)
    unsigned.publishIndex({ version: 1, themes: { sample: { versions: { '1.0.0': entry(BODY_DIGEST) } } } }, false)
    expect((await failure(() => create(unsigned).fetch(pin))).failure).toBe('not-found')

    const swapped = await withSample()
    swapped.publishIndex({ version: 1, themes: { sample: { versions: { '1.0.0': entry(BODY_DIGEST) } } } }, TEST_IDENTITY.packages)
    const error = await failure(() => create(swapped).fetch(pin))
    expect(error.failure).toBe('signature')
    expect(error.message).toContain('index signature')
  })

  it('refuses a forged index: a document signed with another digest', async () => {
    const fake = await withSample()
    const forged = Buffer.from(JSON.stringify({ version: 1, themes: { sample: { versions: { '1.0.0': entry(`sha256:${'d'.repeat(64)}`) } } } }))
    fake.tamper(digestOf(Buffer.from(JSON.stringify({ version: 1, themes: { sample: { versions: { '1.0.0': entry(BODY_DIGEST) } } } }))), forged)
    expect((await failure(() => create(fake).resolve('sample'))).failure).toBe('digest')
  })

  it('refuses a package without an attestation, with a forged one or signed by the identity of the index', async () => {
    const none = await start()
    list(none, none.publish('sample', '1.0.0', BODY, PACKAGE_MEDIA_TYPE, false))
    expect((await failure(() => create(none).fetch(pin))).failure).toBe('not-found')

    const wrongSigner = await start()
    list(wrongSigner, wrongSigner.publish('sample', '1.0.0', BODY, PACKAGE_MEDIA_TYPE, TEST_IDENTITY.index))
    expect((await failure(() => create(wrongSigner).fetch(pin))).failure).toBe('attestation')

    const forged = await withSample()
    const bundle = stubBundle(TEST_IDENTITY.packages, 'e'.repeat(64))
    forged.tamper(digestOf(stubBundle(TEST_IDENTITY.packages, BODY_DIGEST.slice(7))), bundle)
    const error = await failure(() => create(forged).fetch(pin))
    expect(['digest', 'attestation']).toContain(error.failure)
  })

  it('verifies a kept bundle with no network, against the pin', async () => {
    const registry = createRegistry({ registry: 'registry.example.test/themes', identity: TEST_IDENTITY, verifier: stubVerifier, fetch: () => Promise.reject(new Error('no network')) })
    const good = stubBundle(TEST_IDENTITY.packages, BODY_DIGEST.slice(7))
    expect(() => registry.verify(pin, good)).not.toThrow()
    expect(() => registry.verify({ ...pin, digest: `sha256:${'f'.repeat(64)}` }, good)).toThrow(RegistryError)
    expect(() => registry.verify(pin, stubBundle(TEST_IDENTITY.index, BODY_DIGEST.slice(7)))).toThrow(RegistryError)
  })

  it('installs nothing from a registry whose signer is unknown', async () => {
    const fake = await withSample()
    const registry = create(fake, { identity: null })
    expect((await failure(() => registry.resolve('sample'))).failure).toBe('signer')
    expect((await failure(() => registry.fetch(pin))).failure).toBe('signer')
    expect(() => registry.verify(pin, Buffer.from('{}'))).toThrow(/MICELIO_THEME_REGISTRY_IDENTITY/)
    expect(fake.seen).toEqual([])
  })

  it('refuses an invalid pin before any request, as well as before any signer check', async () => {
    const fake = await withSample()
    expect((await failure(() => create(fake, { identity: null }).fetch({ ...pin, version: 'latest' }))).failure).toBe('pin')
  })
})

describe('bounded work on hostile input', () => {
  const sizes = { index: 1024 * 1024 }
  it.each([
    ['nested arrays', '['.repeat(sizes.index)],
    ['an object with many keys', `{"version":1,"themes":{${Array.from({ length: 30_000 }, (_, i) => `"t${i}":{"versions":{}}`).join(',')}}}`.slice(0, sizes.index)],
    ['one very long string', `{"version":1,"themes":{"x":"${'a'.repeat(sizes.index)}"}}`],
  ])('rejects %s of about 1 MiB quickly', (_name, text) => {
    const started = performance.now()
    expect(() => parseIndex(text)).toThrow(RegistryError)
    expect(performance.now() - started).toBeLessThan(2000)
  })

  it('accepts the largest index it reads in bounded time', () => {
    const versions = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`1.0.${i}`, entry(BODY_DIGEST)]))
    const themes = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`theme-${i}`, { versions }]))
    const started = performance.now()
    expect(Object.keys(parseIndex(JSON.stringify({ version: 1, themes })).themes).length).toBe(5)
    expect(performance.now() - started).toBeLessThan(2000)
  })
})
