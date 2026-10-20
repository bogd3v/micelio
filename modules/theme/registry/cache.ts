import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { MAX_BUNDLE_BYTES, MAX_COMPRESSED_BYTES, THEME_DIGEST } from './constants'

// The cache of pulled packages, keyed by digest, so a version that was pulled once installs offline. It is not trusted: a read verifies the digest again.

/** The directory of cached packages: `MICELIO_CACHE_DIR`, else `$XDG_CACHE_HOME/micelio/themes`, else `~/.cache/micelio/themes`. */
export function cacheDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.MICELIO_CACHE_DIR) return join(env.MICELIO_CACHE_DIR, 'themes')
  return join(env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'micelio', 'themes')
}

function fileOf(dir: string, digest: string, suffix: string = '.tgz'): string | null {
  return THEME_DIGEST.test(digest) ? join(dir, `${digest.slice('sha256:'.length)}${suffix}`) : null
}

/** The cached package with this digest, or `null` when there is none or the file no longer matches its name (it is then removed). */
export function cacheGet(digest: string, dir: string = cacheDir()): Buffer | null {
  const file = fileOf(dir, digest)
  if (!file) return null
  let data: Buffer
  try {
    data = readFileSync(file)
  } catch {
    return null // not cached (or unreadable): the caller pulls it
  }
  if (data.length <= MAX_COMPRESSED_BYTES && `sha256:${createHash('sha256').update(data).digest('hex')}` === digest) return data
  rmSync(file, { force: true })
  return null
}

function write(file: string | null, data: Uint8Array, dir: string): void {
  if (!file) return
  const temporary = `${file}.${randomBytes(6).toString('hex')}.tmp`
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    writeFileSync(temporary, data, { mode: 0o600, flag: 'wx' })
    renameSync(temporary, file)
  } catch {
    // a read-only or full cache only costs the next pull a download; the leftover file, if any, is best-effort removed
    try {
      rmSync(temporary, { force: true })
    } catch {
      // nothing more to do: the directory is not usable
    }
  }
}

/** Stores a package under its digest, through a temporary file; a failure to write is not an error, the cache is an optimisation. */
export function cachePut(digest: string, data: Uint8Array, dir: string = cacheDir()): void {
  write(fileOf(dir, digest), data, dir)
}

/** The Sigstore bundle cached next to the package with this digest, or `null`; it is not verified here, the caller verifies it. */
export function cacheGetBundle(digest: string, dir: string = cacheDir()): Buffer | null {
  const file = fileOf(dir, digest, '.sigstore.json')
  if (!file) return null
  try {
    const data = readFileSync(file)
    return data.length <= MAX_BUNDLE_BYTES ? data : null
  } catch {
    return null // not cached: the caller pulls it
  }
}

/** Stores the attestation bundle of the package with this digest, beside the package. */
export function cachePutBundle(digest: string, data: Uint8Array, dir: string = cacheDir()): void {
  write(fileOf(dir, digest, '.sigstore.json'), data, dir)
}
