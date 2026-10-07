import { describe, expect, it } from 'vitest'
import { forwardHeaders, internalClientIp, isInternalFetchTarget, isSafeForwardTarget, normalizeIp, parseTrustProxy, resolveClientIp } from '../server/lib/clientIp'

const resolve = (trust: string, peer: string | null, header: string | null): string =>
  resolveClientIp(parseTrustProxy(trust), peer, header).ip

describe('normalizeIp', () => {
  it('strips ports, brackets and zones, and unwraps IPv4-mapped IPv6', () => {
    expect(normalizeIp('203.0.113.9:4711')).toBe('203.0.113.9')
    expect(normalizeIp('[2001:DB8::1]:443')).toBe('2001:db8::1')
    expect(normalizeIp('fe80::1%eth0')).toBe('fe80::1')
    expect(normalizeIp('::ffff:203.0.113.9')).toBe('203.0.113.9')
    expect(normalizeIp('::ffff:cb00:7109')).toBe('203.0.113.9')
    expect(normalizeIp('2001:0db8:0:0:0:0:0:1')).toBe('2001:db8::1')
  })

  it('rejects anything that is not an address', () => {
    for (const value of ['', 'unknown', '999.1.1.1', '1.2.3', '[::1', null, undefined]) {
      expect(normalizeIp(value)).toBeNull()
    }
  })
})

describe('parseTrustProxy', () => {
  it('refuses true, an empty prefix, prefix 0 and junk', () => {
    expect(() => parseTrustProxy('true')).toThrow(/not allowed/)
    for (const value of ['10.0.0.0/', '0.0.0.0/0', '::/0', '10.0.0.0/33', 'nope', '10.0.0.0/8/8', '10.0.0.0/x']) {
      expect(() => parseTrustProxy(value)).toThrow(/NUXT_TRUST_PROXY/)
    }
  })

  it('takes the values Nitro hands over after destr (boolean and number)', () => {
    expect(parseTrustProxy(false).kind).toBe('none')
    expect(parseTrustProxy(0).kind).toBe('none')
    expect(parseTrustProxy(2)).toEqual({ kind: 'hops', hops: 2 })
    expect(() => parseTrustProxy(true)).toThrow(/not allowed/)
    expect(() => parseTrustProxy('true')).toThrow(/not allowed/)
    expect(parseTrustProxy(null).kind).toBe('peers')
  })

  it('defaults to private peers and understands false', () => {
    expect(parseTrustProxy('').kind).toBe('peers')
    expect(parseTrustProxy(undefined).kind).toBe('peers')
    expect(parseTrustProxy('false').kind).toBe('none')
    expect(parseTrustProxy('0').kind).toBe('none')
    expect(parseTrustProxy('2')).toEqual({ kind: 'hops', hops: 2 })
  })
})

describe('resolveClientIp', () => {
  it('ignores a spoofed leftmost entry behind a private proxy', () => {
    expect(resolve('private', '10.0.0.5', '6.6.6.6, 203.0.113.9')).toBe('203.0.113.9')
    expect(resolve('private', '127.0.0.1', '203.0.113.9')).toBe('203.0.113.9')
  })

  it('walks right to left through trusted hops', () => {
    expect(resolve('private', '::1', '203.0.113.9, 10.1.1.1, 192.168.0.4')).toBe('203.0.113.9')
  })

  it('ignores the header when the peer is public', () => {
    expect(resolve('private', '198.51.100.7', '203.0.113.9')).toBe('198.51.100.7')
  })

  it('falls back to the peer on an invalid entry or no header', () => {
    expect(resolve('private', '10.0.0.5', 'garbage')).toBe('10.0.0.5')
    expect(resolve('private', '10.0.0.5', null)).toBe('10.0.0.5')
  })

  it('counts hops from the right and flags a short chain', () => {
    expect(resolve('1', '10.0.0.5', '6.6.6.6, 203.0.113.9')).toBe('203.0.113.9')
    expect(resolve('2', '10.0.0.5', '203.0.113.9, 10.1.1.1')).toBe('203.0.113.9')
    expect(resolveClientIp(parseTrustProxy('2'), '198.51.100.7', '6.6.6.6')).toEqual({ ip: '198.51.100.7', shortChain: true })
  })

  it('trusts only listed CIDR ranges', () => {
    expect(resolve('198.51.100.0/24', '198.51.100.7', '203.0.113.9')).toBe('203.0.113.9')
    expect(resolve('198.51.100.0/24', '10.0.0.5', '203.0.113.9')).toBe('10.0.0.5')
    expect(resolve('private,198.51.100.0/24', '10.0.0.5', '203.0.113.9')).toBe('203.0.113.9')
  })

  it('never reads the header with false', () => {
    expect(resolve('false', '10.0.0.5', '203.0.113.9')).toBe('10.0.0.5')
  })

  it('handles IPv6 and IPv4-mapped peers', () => {
    expect(resolve('private', '::ffff:10.0.0.5', '[2001:db8::7]:5000')).toBe('2001:db8::7')
    expect(resolve('private', 'fd00::1', '2001:DB8:0:0::7')).toBe('2001:db8::7')
    expect(resolve('private', '::ffff:198.51.100.7', '203.0.113.9')).toBe('198.51.100.7')
  })

  it('reports unknown without a socket address', () => {
    expect(resolve('private', null, '203.0.113.9')).toBe('unknown')
  })
})

describe('forwardHeaders', () => {
  const secret = 'a'.repeat(32)

  it('is empty while the secret is unset', () => {
    expect(forwardHeaders('', '203.0.113.9')).toEqual({})
    expect(forwardHeaders(undefined, '203.0.113.9')).toEqual({})
  })

  it('sends both headers with a valid secret and address', () => {
    expect(forwardHeaders(secret, '203.0.113.9')).toEqual({
      'X-Micelio-Forwarder-Secret': secret,
      'X-Micelio-Client-IP': '203.0.113.9',
    })
    expect(forwardHeaders(secret, '2001:db8::1')['X-Micelio-Client-IP']).toBe('2001:db8::1')
  })

  it('does not forward an address that is not valid', () => {
    for (const ip of ['unknown', '', null, undefined, '1.2.3.4:80']) expect(forwardHeaders(secret, ip)).toEqual({})
  })

  it('fails clearly on a short secret, without printing it', () => {
    const short = 'short-secret'
    expect(() => forwardHeaders(short, '203.0.113.9')).toThrow(/NUXT_STRAPI_FORWARDER_SECRET.*32/)
    try {
      forwardHeaders(short, '203.0.113.9')
    } catch (error) {
      expect(String(error)).not.toContain(short)
    }
  })
})

describe('forwardHeaders secret handling', () => {
  it('keeps the secret exactly as written, untrimmed, even when it looks like a number', () => {
    const padded = ` ${'1'.repeat(32)} `
    expect(forwardHeaders(padded, '203.0.113.9')['X-Micelio-Forwarder-Secret']).toBe(padded)
  })
})

describe('internalClientIp', () => {
  const nonce = 'n'.repeat(64)

  it('accepts the address of an in-process call that carries the nonce', () => {
    expect(internalClientIp(undefined, '[2001:DB8::1]:80', nonce, nonce)).toBe('2001:db8::1')
    expect(internalClientIp('', '203.0.113.9', nonce, nonce)).toBe('203.0.113.9')
  })

  it('ignores a call that has a socket address, a wrong or missing nonce, or a bad address', () => {
    expect(internalClientIp('198.51.100.7', '203.0.113.9', nonce, nonce)).toBeNull()
    expect(internalClientIp('127.0.0.1', '203.0.113.9', nonce, nonce)).toBeNull()
    expect(internalClientIp(undefined, '203.0.113.9', 'wrong', nonce)).toBeNull()
    expect(internalClientIp(undefined, '203.0.113.9', 'n'.repeat(63) + 'x', nonce)).toBeNull()
    expect(internalClientIp(undefined, '203.0.113.9', undefined, nonce)).toBeNull()
    expect(internalClientIp(undefined, 'not-an-ip', nonce, nonce)).toBeNull()
    expect(internalClientIp(undefined, '203.0.113.9', '', '')).toBeNull()
  })
})

describe('isSafeForwardTarget', () => {
  it('allows https and private or internal hosts only', () => {
    for (const url of ['https://cms.example.org', 'http://localhost:1337', 'http://127.0.0.1:1337', 'http://10.0.0.4:1337', 'http://[::1]:1337', 'http://cms:1337', 'http://strapi.internal']) {
      expect(isSafeForwardTarget(url)).toBe(true)
    }
    for (const url of ['http://cms.example.org', 'http://203.0.113.9:1337', 'ftp://cms', 'not a url']) {
      expect(isSafeForwardTarget(url)).toBe(false)
    }
  })
})

describe('isInternalFetchTarget', () => {
  it('is true only for same-origin relative paths', () => {
    expect(isInternalFetchTarget('/api/auth/me')).toBe(true)
    for (const request of ['https://evil.example/api', 'http://localhost/api', '//evil.example/api', 'api/x', '', new URL('https://a.example/'), undefined]) {
      expect(isInternalFetchTarget(request)).toBe(false)
    }
  })
})
