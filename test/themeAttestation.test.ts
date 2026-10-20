import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { signerOptions, trustRootProblem, verifyBundle } from '../modules/theme/registry/attestation'
import type { VerifyBundleOptions } from '../modules/theme/registry/attestation'
import { DEFAULT_SIGNER, MAX_BUNDLE_BYTES } from '../modules/theme/registry/constants'
import { RegistryError } from '../modules/theme/registry/error'
import type { RegistryFailure } from '../modules/theme/registry/types'
import shippedRoot from '../modules/theme/registry/trusted_root.json'

// A real bundle: the SLSA provenance that npm published for @sigstore/verify 4.1.2, signed by a GitHub Actions workflow of the
// sigstore-js repository through the public-good Sigstore. It stands in for the attestation of a theme package, which has the same
// shape (a DSSE envelope, a Fulcio certificate, a Rekor entry with an inclusion proof) but whose workflow does not exist yet.

const FIXTURE = join(process.cwd(), 'test/fixtures/sigstore/provenance.sigstore.json')
const TEXT = readFileSync(FIXTURE, 'utf8')
const BUNDLE = JSON.parse(TEXT) as { dsseEnvelope: { payload: string, signatures: Array<{ sig: string }> }, verificationMaterial: Record<string, unknown> }
const SAN = 'https://github.com/sigstore/sigstore-js/.github/workflows/release.yml@refs/heads/main'
const ISSUER = 'https://token.actions.githubusercontent.com'
const SHA512 = '05f0fd78baf3dc0fc31b9f1a4a07e065898847a57d630f7a41537f7ebb6ed9b107edcb524e4d930ef1d4d76ba7dc9b033c14ea4cd92a90892e723c658e9385a9'
const OPTIONS: VerifyBundleOptions = { subject: { algorithm: 'sha512', hex: SHA512 }, san: SAN, issuer: ISSUER }

function failure(run: () => unknown): RegistryFailure {
  try {
    run()
  } catch (error) {
    if (error instanceof RegistryError) return error.failure
    throw error
  }
  throw new Error('expected a RegistryError')
}

function withBundle(change: (bundle: typeof BUNDLE) => void): Buffer {
  const copy = JSON.parse(TEXT) as typeof BUNDLE
  change(copy)
  return Buffer.from(JSON.stringify(copy))
}

function reencode(bundle: typeof BUNDLE, change: (statement: { subject: Array<{ digest: Record<string, string> }> }) => void): void {
  const statement = JSON.parse(Buffer.from(bundle.dsseEnvelope.payload, 'base64').toString('utf8')) as { subject: Array<{ digest: Record<string, string> }> }
  change(statement)
  bundle.dsseEnvelope.payload = Buffer.from(JSON.stringify(statement)).toString('base64')
}

describe('verifying a Sigstore bundle offline', () => {
  it('accepts a real bundle against its signer, issuer and subject, with no network', () => {
    expect(() => verifyBundle(Buffer.from(TEXT), OPTIONS)).not.toThrow()
  })

  it('refuses another signer, matched whole and not as a pattern', () => {
    expect(failure(() => verifyBundle(Buffer.from(TEXT), { ...OPTIONS, san: 'https://github.com/sigstore/sigstore-js/.github/workflows/other.yml@refs/heads/main' }))).toBe('attestation')
    expect(failure(() => verifyBundle(Buffer.from(TEXT), { ...OPTIONS, san: 'https://github.com/sigstore/sigstore-js/.github/workflows/release.yml@refs/heads/mai' }))).toBe('attestation')
    expect(failure(() => verifyBundle(Buffer.from(TEXT), { ...OPTIONS, san: 'https://github.com/sigstore/sigstore-js/.github/workflows/release.yml@refs/heads/main.*' }))).toBe('attestation')
    expect(failure(() => verifyBundle(Buffer.from(TEXT), { ...OPTIONS, san: '.*' }))).toBe('attestation')
    expect(failure(() => verifyBundle(Buffer.from(TEXT), { ...OPTIONS, san: `${SAN}x` }))).toBe('attestation')
  })

  it('refuses another issuer', () => {
    expect(failure(() => verifyBundle(Buffer.from(TEXT), { ...OPTIONS, issuer: 'https://accounts.google.com' }))).toBe('attestation')
  })

  it('refuses the default signer of the core: the real bundle is not from the theme registry', () => {
    expect(failure(() => verifyBundle(Buffer.from(TEXT), { ...OPTIONS, ...signerOptions(DEFAULT_SIGNER, 'packages') }))).toBe('attestation')
  })

  it('refuses a digest the statement does not name, or in another algorithm', () => {
    expect(failure(() => verifyBundle(Buffer.from(TEXT), { ...OPTIONS, subject: { algorithm: 'sha512', hex: `${SHA512.slice(0, -1)}0` } }))).toBe('attestation')
    expect(failure(() => verifyBundle(Buffer.from(TEXT), { ...OPTIONS, subject: { algorithm: 'sha256', hex: SHA512.slice(0, 64) } }))).toBe('attestation')
  })

  it('refuses a forged statement: the signature no longer covers the payload', () => {
    const forged = withBundle(bundle => reencode(bundle, (statement) => {
      statement.subject = [{ digest: { sha256: 'a'.repeat(64) } }]
    }))
    expect(failure(() => verifyBundle(forged, { ...OPTIONS, subject: { algorithm: 'sha256', hex: 'a'.repeat(64) } }))).toBe('attestation')
  })

  it('refuses a bundle whose signature was altered', () => {
    const altered = withBundle((bundle) => {
      const sig = Buffer.from(bundle.dsseEnvelope.signatures[0]?.sig ?? '', 'base64')
      sig[10] = (sig[10] ?? 0) ^ 0xFF
      ;(bundle.dsseEnvelope.signatures[0] as { sig: string }).sig = sig.toString('base64')
    })
    expect(failure(() => verifyBundle(altered, OPTIONS))).toBe('attestation')
  })

  it('refuses a bundle with its transparency log entry removed or changed', () => {
    expect(['attestation', 'trust-root']).toContain(failure(() => verifyBundle(withBundle((bundle) => {
      bundle.verificationMaterial.tlogEntries = []
    }), OPTIONS)))
    const changed = withBundle((bundle) => {
      const entries = bundle.verificationMaterial.tlogEntries as Array<{ canonicalizedBody: string }>
      const body = Buffer.from(entries[0]?.canonicalizedBody ?? '', 'base64')
      body[body.length - 5] = (body[body.length - 5] ?? 0) ^ 0x01
      ;(entries[0] as { canonicalizedBody: string }).canonicalizedBody = body.toString('base64')
    })
    expect(['attestation', 'trust-root']).toContain(failure(() => verifyBundle(changed, OPTIONS)))
  })

  it.each([
    ['text that is not JSON', Buffer.from('{')],
    ['an empty object', Buffer.from('{}')],
    ['an array', Buffer.from('[]')],
    ['nothing', Buffer.alloc(0)],
  ])('refuses %s', (_name, data) => {
    expect(failure(() => verifyBundle(data, OPTIONS))).toBe('attestation')
  })

  it('refuses a bundle that is not a certificate-signed in-toto statement', () => {
    const wrongType = withBundle((bundle) => {
      bundle.dsseEnvelope = { ...bundle.dsseEnvelope, payloadType: 'text/plain' } as typeof bundle.dsseEnvelope
    })
    expect(failure(() => verifyBundle(wrongType, OPTIONS))).toBe('attestation')
  })

  it('refuses a bundle over its size cap without parsing it', () => {
    expect(failure(() => verifyBundle(Buffer.alloc(MAX_BUNDLE_BYTES + 1, 0x7B), OPTIONS))).toBe('attestation')
  })

  it('stays within a bounded time for the largest bundle it reads', () => {
    const started = performance.now()
    expect(failure(() => verifyBundle(Buffer.from(`{"a":"${'x'.repeat(MAX_BUNDLE_BYTES - 20)}"}`), OPTIONS))).toBe('attestation')
    expect(failure(() => verifyBundle(Buffer.from('['.repeat(MAX_BUNDLE_BYTES)), OPTIONS))).toBe('attestation')
    expect(performance.now() - started).toBeLessThan(2000)
  })
})

describe('the trusted root', () => {
  type Root = { certificateAuthorities: Array<{ validFor?: { start?: string, end?: string } }>, tlogs: Array<{ publicKey: { validFor?: { start?: string, end?: string } } }> }
  const clone = (): Root => JSON.parse(JSON.stringify(shippedRoot)) as Root

  it('that ships with Micelio is valid now and for the next years', () => {
    expect(trustRootProblem(shippedRoot, new Date('2026-10-20T00:00:00Z'))).toBeNull()
  })

  it('is expired when no certificate authority or no log is valid at the time', () => {
    const noCa = clone()
    noCa.certificateAuthorities.forEach((authority) => {
      authority.validFor = { ...authority.validFor, end: '2024-01-01T00:00:00Z' }
    })
    expect(trustRootProblem(noCa, new Date('2026-10-20T00:00:00Z'))).toMatch(/certificate authority/)
    const noLog = clone()
    noLog.tlogs.forEach((log) => {
      log.publicKey.validFor = { ...log.publicKey.validFor, end: '2024-01-01T00:00:00Z' }
    })
    expect(trustRootProblem(noLog, new Date('2026-10-20T00:00:00Z'))).toMatch(/transparency log/)
    expect(trustRootProblem({}, new Date())).not.toBeNull()
  })

  it('fails closed with the upgrade named when it is expired', () => {
    const expired = clone()
    expired.certificateAuthorities.forEach((authority) => {
      authority.validFor = { ...authority.validFor, end: '2024-01-01T00:00:00Z' }
    })
    const run = (): void => verifyBundle(Buffer.from(TEXT), { ...OPTIONS, root: expired })
    expect(failure(run)).toBe('trust-root')
    expect(() => run()).toThrow(/upgrade Micelio/)
  })

  it('fails closed with the upgrade named when it does not cover the signing certificate', () => {
    const other = clone()
    other.certificateAuthorities = other.certificateAuthorities.slice(0, 1)
    const run = (): void => verifyBundle(Buffer.from(TEXT), { ...OPTIONS, root: other })
    expect(failure(run)).toBe('trust-root')
    expect(() => run()).toThrow(/upgrade Micelio/)
  })
})
