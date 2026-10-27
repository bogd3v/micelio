import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ENV_NAME = 'PREVIEW_TLS_DIR'

/**
 * The directory with a throwaway `cert.pem` and `key.pem` (valid one day, for `127.0.0.1` and `localhost`) that the preview e2e serves over https.
 *
 * @remarks
 * Made with `openssl` on the first call of a run and removed when that process exits; nothing is committed. The path is kept in the environment, so the workers that load the config again reuse it.
 * The browsers run with `ignoreHTTPSErrors`: the certificate is self-signed.
 */
export function previewTlsDir(): string {
  const existing = process.env[ENV_NAME]
  if (existing) return existing
  const dir = mkdtempSync(join(tmpdir(), 'micelio-preview-tls-'))
  try {
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
      '-keyout', join(dir, 'key.pem'), '-out', join(dir, 'cert.pem'),
      '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
    ], { stdio: 'pipe' })
  } catch (error) {
    rmSync(dir, { recursive: true, force: true })
    throw new Error('The preview e2e needs the openssl command to make its throwaway certificate', { cause: error })
  }
  process.env[ENV_NAME] = dir
  process.once('exit', () => rmSync(dir, { recursive: true, force: true }))
  return dir
}
