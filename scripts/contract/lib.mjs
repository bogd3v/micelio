// Pure helpers of the contract runner (scripts/contract/run.mjs), unit-tested in test/contract-runner.test.ts
import { randomBytes } from 'node:crypto'

/** The digest in the output of `docker buildx imagetools inspect <image>` (its `Digest:` line), or `null` */
export function digestFrom(inspectOutput) {
  return /^Digest:\s+(sha256:[0-9a-f]{64})\s*$/m.exec(inspectOutput)?.[1] ?? null
}

/** `name:tag` as `name@sha256:...` (the tag is dropped: the digest decides); a reference that already has a digest is kept */
export function pinnedImage(ref, digest) {
  if (ref.includes('@sha256:')) return ref
  const name = ref.replace(/:[^/:]+$/, '')
  return `${name}@${digest}`
}

/** A random value of `bytes` bytes, base64 without characters that need quoting */
export function secret(bytes = 24) {
  return randomBytes(bytes).toString('base64').replace(/[^A-Za-z0-9]/g, '')
}

/**
 * The environment of the demo CMS container: Postgres, the demo seed and the frontend's API token, which the CMS creates on boot
 * from `FRONTEND_API_TOKEN` (docs/API_TOKENS.md of micelio-cms). The keys are random for each run.
 */
export function cmsEnvironment({ databaseHost, databasePassword, frontendToken, cmsUrl, frontendUrl }) {
  return {
    NODE_ENV: 'production',
    DATABASE_CLIENT: 'postgres',
    DATABASE_HOST: databaseHost,
    DATABASE_PORT: '5432',
    DATABASE_NAME: 'strapi',
    DATABASE_USERNAME: 'strapi',
    DATABASE_PASSWORD: databasePassword,
    DATABASE_SSL: 'false',
    APP_KEYS: [secret(), secret(), secret(), secret()].join(','),
    API_TOKEN_SALT: secret(),
    ADMIN_JWT_SECRET: secret(),
    TRANSFER_TOKEN_SALT: secret(),
    JWT_SECRET: secret(),
    ENCRYPTION_KEY: secret(),
    URL: cmsUrl,
    FRONTEND_URL: frontendUrl,
    MICELIO_DEMO: 'true',
    FRONTEND_API_TOKEN: frontendToken,
    // No proxy in front of the container: the socket address is the client
    TRUST_PROXY: 'false',
  }
}
