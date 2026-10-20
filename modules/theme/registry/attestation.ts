import { bundleFromJSON } from '@sigstore/bundle'
import { TrustedRoot } from '@sigstore/protobuf-specs'
import { PolicyError, toSignedEntity, toTrustMaterial, VerificationError, Verifier } from '@sigstore/verify'
import { MAX_BUNDLE_BYTES } from './constants'
import { RegistryError } from './error'
import trustedRootJson from './trusted_root.json'
import type { SignerIdentity } from './types'

// Offline verification of a Sigstore bundle (ADR 0009, section 3): the signing certificate chains to the Fulcio CA of the trusted
// root, the transparency log entry (inclusion proof and signed time) is in the log of the trusted root, the signature is valid, the
// signer is exactly the expected workflow, and the signed statement is a SLSA provenance for exactly the expected digest. Nothing is
// fetched: the trusted root is a file of this repository, refreshed in every release.

const IN_TOTO_PAYLOAD = 'application/vnd.in-toto+json'
const IN_TOTO_STATEMENTS = new Set(['https://in-toto.io/Statement/v0.1', 'https://in-toto.io/Statement/v1'])
const PROVENANCE = 'https://slsa.dev/provenance/'
/** Verification errors that say the trust material does not cover the bundle (the root is out of date or the bundle is not from this log). */
const ROOT_CODES = new Set(['CERTIFICATE_ERROR', 'TLOG_ERROR', 'TLOG_INCLUSION_PROOF_ERROR', 'TLOG_INCLUSION_PROMISE_ERROR', 'TLOG_MISSING_INCLUSION_ERROR', 'TIMESTAMP_ERROR', 'PUBLIC_KEY_ERROR'])
const UPGRADE = 'the Sigstore trust root shipped with this version of Micelio does not verify it; if the package was signed recently, upgrade Micelio (the root is refreshed in every release)'

/** The digest a signed statement must name. */
export interface BundleSubject {
  algorithm: 'sha256' | 'sha512'
  /** Lowercase hex. */
  hex: string
}

/** What `verifyBundle` checks a bundle against. */
export interface VerifyBundleOptions {
  subject: BundleSubject
  /** The exact subject alternative name of the signing certificate. */
  san: string
  /** The exact OIDC issuer of the signing certificate. */
  issuer: string
  /** The Sigstore trusted root to verify against; the one shipped with Micelio when not given. */
  root?: unknown
}

/** A function that verifies a bundle, so callers can be tested without real signatures. */
export type BundleVerifier = (bundle: Uint8Array, options: VerifyBundleOptions) => void

/**
 * The first problem with the validity of a trusted root at `now`, or `null` when it can verify a bundle signed now.
 *
 * @remarks
 * A root can verify only while it holds a certificate authority and a transparency log that are valid at the time (no `end`, or an `end` in
 * the future). An empty or fully expired root is what a core released long ago would carry after the keys rotated.
 */
export function trustRootProblem(root: unknown, now: Date): string | null {
  const value = root as { certificateAuthorities?: Array<{ validFor?: { end?: string } }>, tlogs?: Array<{ publicKey?: { validFor?: { end?: string } } }> }
  const open = (end: string | undefined): boolean => end === undefined || new Date(end) > now
  if (!value.certificateAuthorities?.some(authority => open(authority.validFor?.end))) return 'the trusted root has no certificate authority that is valid now'
  if (!value.tlogs?.some(log => open(log.publicKey?.validFor?.end))) return 'the trusted root has no transparency log that is valid now'
  return null
}

function fail(failure: 'attestation' | 'trust-root', detail: string, cause?: unknown): RegistryError {
  return new RegistryError(failure, detail, {}, cause === undefined ? undefined : { cause })
}

/**
 * Verifies a Sigstore bundle of an in-toto SLSA provenance, offline, or throws.
 *
 * @remarks
 * Checked, in order: the size of the bundle; its structure (a DSSE envelope with a certificate, never a bare key); the certificate
 * chain, the transparency log entry with its inclusion proof and the signed time, and the signature, against the trusted root; the
 * issuer and subject alternative name equal to `options` (whole-string equality, not a pattern); the payload type, the statement
 * type, a `https://slsa.dev/provenance/` predicate, and a subject whose digest is exactly `options.subject`. The bundle is a document
 * of the registry: nothing in it is trusted before it is verified.
 *
 * @throws `RegistryError` (`attestation`) for any check that fails, (`trust-root`) when the trusted root cannot verify it or is expired.
 */
export function verifyBundle(bundle: Uint8Array, options: VerifyBundleOptions): void {
  if (bundle.length > MAX_BUNDLE_BYTES) throw fail('attestation', `the bundle is larger than ${MAX_BUNDLE_BYTES} bytes`)
  const rootJson = options.root ?? trustedRootJson
  const expired = trustRootProblem(rootJson, new Date())
  if (expired) throw fail('trust-root', `${expired}: upgrade Micelio`)
  let parsed
  try {
    parsed = bundleFromJSON(JSON.parse(Buffer.from(bundle).toString('utf8')))
  } catch (error) {
    throw fail('attestation', 'the bundle is not a Sigstore bundle', error)
  }
  if (parsed.content.$case !== 'dsseEnvelope') throw fail('attestation', 'the bundle does not sign an in-toto statement')
  const envelope = parsed.content.dsseEnvelope
  let signer
  try {
    const entity = toSignedEntity(parsed)
    if (entity.key.$case !== 'certificate') throw fail('attestation', 'the bundle is signed with a key, not a certificate')
    signer = new Verifier(toTrustMaterial(TrustedRoot.fromJSON(rootJson))).verify(entity)
  } catch (error) {
    if (error instanceof RegistryError) throw error
    if (error instanceof PolicyError) throw fail('attestation', 'the signer is not the expected one', error)
    if (error instanceof VerificationError && ROOT_CODES.has(error.code)) throw fail('trust-root', `the bundle does not verify (${error.code}): ${UPGRADE}`, error)
    throw fail('attestation', `the bundle does not verify${error instanceof VerificationError ? ` (${error.code})` : ''}`, error)
  }
  if (signer.identity?.subjectAlternativeName !== options.san) throw fail('attestation', `signed by ${String(signer.identity?.subjectAlternativeName)}, not by the expected workflow ${options.san}`)
  if (signer.identity.extensions?.issuer !== options.issuer) throw fail('attestation', `the certificate issuer is ${String(signer.identity.extensions?.issuer)}, not ${options.issuer}`)
  if (envelope.payloadType !== IN_TOTO_PAYLOAD) throw fail('attestation', 'the signed payload is not an in-toto statement')
  let statement: { _type?: unknown, predicateType?: unknown, subject?: unknown }
  try {
    statement = JSON.parse(Buffer.from(envelope.payload).toString('utf8')) as typeof statement
  } catch (error) {
    throw fail('attestation', 'the signed statement is not JSON', error)
  }
  if (typeof statement._type !== 'string' || !IN_TOTO_STATEMENTS.has(statement._type)) throw fail('attestation', 'the signed statement is not an in-toto statement')
  if (typeof statement.predicateType !== 'string' || !statement.predicateType.startsWith(PROVENANCE)) throw fail('attestation', 'the signed statement is not a SLSA provenance')
  const subjects = Array.isArray(statement.subject) ? statement.subject as Array<{ digest?: Record<string, unknown> }> : []
  if (!subjects.some(subject => subject?.digest?.[options.subject.algorithm] === options.subject.hex)) {
    throw fail('attestation', `the signed statement does not name ${options.subject.algorithm}:${options.subject.hex}`)
  }
}

/** The signer to expect, for the package or the index, as `verifyBundle` wants it. */
export function signerOptions(identity: SignerIdentity, what: 'packages' | 'index'): Pick<VerifyBundleOptions, 'san' | 'issuer'> {
  return { san: identity[what], issuer: identity.issuer }
}
