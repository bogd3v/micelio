import { describe, expect, it } from 'vitest'
import { cmsEnvironment, digestFrom, pinnedImage, secret } from '../scripts/contract/lib.mjs'

const DIGEST = `sha256:${'ab'.repeat(32)}`

describe('digestFrom', () => {
  it('reads the Digest line of `docker buildx imagetools inspect`', () => {
    const output = `Name:      ghcr.io/example/cms:latest\nMediaType: application/vnd.oci.image.index.v1+json\nDigest:    ${DIGEST}\n\nManifests:\n  Digest:    sha256:${'cd'.repeat(32)}\n`
    expect(digestFrom(output)).toBe(DIGEST)
  })

  it('answers null when there is no digest', () => {
    expect(digestFrom('ERROR: not found')).toBeNull()
    expect(digestFrom('Digest: sha256:short')).toBeNull()
  })
})

describe('pinnedImage', () => {
  it('replaces the tag with the digest', () => {
    expect(pinnedImage('ghcr.io/example/cms:latest', DIGEST)).toBe(`ghcr.io/example/cms@${DIGEST}`)
  })

  it('keeps a reference without a tag and the registry port', () => {
    expect(pinnedImage('ghcr.io/example/cms', DIGEST)).toBe(`ghcr.io/example/cms@${DIGEST}`)
    expect(pinnedImage('localhost:5000/cms:1.2', DIGEST)).toBe(`localhost:5000/cms@${DIGEST}`)
  })

  it('keeps a reference that already has a digest', () => {
    expect(pinnedImage(`ghcr.io/example/cms@${DIGEST}`, `sha256:${'ef'.repeat(32)}`)).toBe(`ghcr.io/example/cms@${DIGEST}`)
  })
})

describe('secret', () => {
  it('is random, and safe to put in an environment file', () => {
    expect(secret()).not.toBe(secret())
    expect(secret(48)).toMatch(/^[A-Za-z0-9]+$/)
  })
})

describe('cmsEnvironment', () => {
  const environment = cmsEnvironment({ databaseHost: 'db', databasePassword: 'pw', frontendToken: 'token', cmsUrl: 'http://127.0.0.1:1347', frontendUrl: 'http://127.0.0.1:3270' })

  it('points the CMS at Postgres, turns the demo seed on and hands over the frontend token', () => {
    expect(environment).toMatchObject({ DATABASE_CLIENT: 'postgres', DATABASE_HOST: 'db', DATABASE_PASSWORD: 'pw', MICELIO_DEMO: 'true', FRONTEND_API_TOKEN: 'token', URL: 'http://127.0.0.1:1347', FRONTEND_URL: 'http://127.0.0.1:3270' })
  })

  it('generates four app keys and distinct salts and secrets for each run', () => {
    expect(environment.APP_KEYS.split(',')).toHaveLength(4)
    const salts = [environment.API_TOKEN_SALT, environment.ADMIN_JWT_SECRET, environment.TRANSFER_TOKEN_SALT, environment.JWT_SECRET, environment.ENCRYPTION_KEY]
    expect(new Set(salts).size).toBe(salts.length)
    expect(cmsEnvironment({ databaseHost: 'db', databasePassword: 'pw', frontendToken: 'token', cmsUrl: 'u', frontendUrl: 'f' }).JWT_SECRET).not.toBe(environment.JWT_SECRET)
  })
})
