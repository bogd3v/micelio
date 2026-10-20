import { afterEach, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cacheDir, cacheGet, cachePut } from '../modules/theme/registry/cache'
import { RegistryError, safeText } from '../modules/theme/registry/error'
import { formatLock, parseLock, readLock, writeLock } from '../modules/theme/registry/lock'
import { checkIdentity, pruneThemes, writeTheme } from '../modules/theme/registry/materialize'
import { assertPin, pinProblem } from '../modules/theme/registry/pin'
import { compareVersions, highestSatisfying, satisfies } from '../modules/theme/registry/semver'
import { unpackTheme } from '../modules/theme/registry/unpack'
import type { LockEntry, ThemePin } from '../modules/theme/registry/types'
import { packageOf } from './fixtures/tar'

const DIGEST = `sha256:${'a'.repeat(64)}`
const ENTRY: LockEntry = { version: '1.0.0', digest: DIGEST, contract: '2.0', tier: 'official', distribution: 'public', registry: 'registry.example.com/themes', code: false }
const dirs: string[] = []

function temp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'micelio-pins-'))
  dirs.push(dir)
  return dir
}

function failure(run: () => unknown): RegistryError {
  try {
    run()
  } catch (error) {
    if (error instanceof RegistryError) return error
    throw error
  }
  throw new Error('expected a RegistryError')
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('the grammar of a pin', () => {
  const good = { id: 'my-theme', version: '1.2.3-rc.1', digest: DIGEST }

  it('accepts an id, an exact version and a sha256 digest', () => {
    expect(pinProblem(good)).toBeNull()
    expect(assertPin(good)).toEqual(good)
  })

  it.each([
    ['an uppercase id', { ...good, id: 'My-Theme' }],
    ['an id with a path', { ...good, id: '../x' }],
    ['a double hyphen', { ...good, id: 'a--b' }],
    ['an empty id', { ...good, id: '' }],
    ['an id of 65 characters', { ...good, id: 'a'.repeat(65) }],
    ['a range as the version', { ...good, version: '^1.0.0' }],
    ['build metadata', { ...good, version: '1.0.0+build' }],
    ['a leading zero', { ...good, version: '01.0.0' }],
    ['a version of 129 characters', { ...good, version: `1.0.0-${'a'.repeat(123)}` }],
    ['a short digest', { ...good, digest: 'sha256:abc' }],
    ['an uppercase digest', { ...good, digest: `sha256:${'A'.repeat(64)}` }],
    ['another algorithm', { ...good, digest: `sha512:${'a'.repeat(64)}` }],
    ['a trailing newline', { ...good, digest: `${DIGEST}\n` }],
    ['a number as the id', { ...good, id: 7 }],
    ['nothing', null],
  ])('refuses %s', (_name, pin) => {
    expect(pinProblem(pin)).not.toBeNull()
    expect(failure(() => assertPin(pin)).failure).toBe('pin')
  })

  it('does not echo the invalid value', () => {
    expect(failure(() => assertPin({ ...good, id: 'Secret/../value' })).message).not.toContain('Secret')
  })
})

describe('versions and ranges', () => {
  it('orders versions as semver 2.0.0 does', () => {
    const ordered = ['1.0.0-alpha', '1.0.0-alpha.1', '1.0.0-alpha.beta', '1.0.0-beta', '1.0.0-beta.2', '1.0.0-beta.11', '1.0.0-rc.1', '1.0.0', '1.0.1', '1.1.0', '2.0.0']
    expect([...ordered].reverse().sort(compareVersions)).toEqual(ordered)
  })

  it.each([
    ['1.2.3', '1.2.3', true], ['1.2.3', '1.2.4', false],
    ['^1.2.3', '1.9.0', true], ['^1.2.3', '1.2.2', false], ['^1.2.3', '2.0.0', false],
    ['^0.2.3', '0.2.9', true], ['^0.2.3', '0.3.0', false], ['^0.0.3', '0.0.3', true], ['^0.0.3', '0.0.4', false],
    ['~1.2.3', '1.2.9', true], ['~1.2.3', '1.3.0', false], ['~1', '1.9.9', true],
    ['1', '1.4.0', true], ['1', '2.0.0', false], ['1.2', '1.2.7', true], ['1.2', '1.3.0', false],
    ['*', '9.9.9', true], ['*', '1.0.0-rc.1', false], ['^1.0.0', '1.1.0-rc.1', false], ['1.1.0-rc.1', '1.1.0-rc.1', true],
  ])('range %s and version %s: %s', (range, version, expected) => {
    expect(satisfies(version, range)).toBe(expected)
  })

  it('picks the highest stable version that satisfies a range', () => {
    const versions = ['1.0.0', '1.2.0', '1.3.0-rc.1', '1.2.5', '2.0.0']
    expect(highestSatisfying(versions, '^1.0.0')).toBe('1.2.5')
    expect(highestSatisfying(versions, '*')).toBe('2.0.0')
    expect(highestSatisfying(versions, '3')).toBeNull()
  })

  it('refuses something that is not a range', () => {
    expect(failure(() => satisfies('1.0.0', '>=1.0.0')).failure).toBe('pin')
    expect(failure(() => satisfies('1.0.0', 'latest')).failure).toBe('pin')
  })
})

describe('themes.lock.json', () => {
  it('round-trips through the file with sorted ids and a final newline', () => {
    const root = temp()
    writeLock(root, { zeta: ENTRY, alpha: { ...ENTRY, tier: 'local', distribution: 'file', registry: null } })
    const text = readFileSync(join(root, 'themes.lock.json'), 'utf8')
    expect(text.endsWith('}\n')).toBe(true)
    expect(Object.keys(JSON.parse(text) as object)).toEqual(['alpha', 'zeta'])
    expect(readLock(root)).toEqual(parseLock(text))
    expect(readdirSync(root)).toEqual(['themes.lock.json'])
  })

  it('is an empty lock when the file does not exist', () => {
    expect(readLock(temp())).toEqual({})
  })

  it('formats the same lock to the same bytes', () => {
    expect(formatLock({ b: ENTRY, a: ENTRY })).toBe(formatLock({ a: ENTRY, b: ENTRY }))
  })

  it.each([
    ['text that is not JSON', '{'],
    ['an array', '[]'],
    ['an entry that is not an object', '{"a":1}'],
    ['an unknown field', JSON.stringify({ a: { ...ENTRY, extra: 1 } })],
    ['a range as the version', JSON.stringify({ a: { ...ENTRY, version: '^1.0.0' } })],
    ['a bad digest', JSON.stringify({ a: { ...ENTRY, digest: 'sha256:x' } })],
    ['a bad id', JSON.stringify({ '../a': ENTRY })],
    ['a prototype key', '{"__proto__":{"version":"1.0.0"}}'],
    ['a contract that is not major.minor', JSON.stringify({ a: { ...ENTRY, contract: 'two' } })],
    ['a file entry that names a registry', JSON.stringify({ a: { ...ENTRY, tier: 'local', distribution: 'file' } })],
    ['a registry entry without a registry', JSON.stringify({ a: { ...ENTRY, registry: null } })],
    ['an official file entry', JSON.stringify({ a: { ...ENTRY, distribution: 'file', registry: null } })],
    ['an unknown tier', JSON.stringify({ a: { ...ENTRY, tier: 'gold' } })],
  ])('refuses %s', (_name, text) => {
    expect(failure(() => parseLock(text)).failure).toBe('lock')
  })

  it('refuses a file over its size cap without parsing it', () => {
    const root = temp()
    writeFileSync(join(root, 'themes.lock.json'), ' '.repeat(256 * 1024 + 1))
    expect(failure(() => readLock(root)).message).toContain('larger than')
  })
})

describe('the cache', () => {
  const data = Buffer.from('package bytes')
  const digest = `sha256:${createHash('sha256').update(data).digest('hex')}`

  it('returns what was stored, by digest', () => {
    const dir = temp()
    expect(cacheGet(digest, dir)).toBeNull()
    cachePut(digest, data, dir)
    expect(cacheGet(digest, dir)?.equals(data)).toBe(true)
  })

  it('treats a file that no longer matches its name as a miss and removes it', () => {
    const dir = temp()
    cachePut(digest, data, dir)
    const file = join(dir, `${digest.slice(7)}.tgz`)
    writeFileSync(file, 'tampered')
    expect(cacheGet(digest, dir)).toBeNull()
    expect(existsSync(file)).toBe(false)
  })

  it('ignores a digest that is not one, so it never builds a path from it', () => {
    const dir = temp()
    cachePut('../../etc/passwd', data, dir)
    expect(readdirSync(dir)).toEqual([])
    expect(cacheGet('../../etc/passwd', dir)).toBeNull()
  })

  it('does not fail when the directory cannot be written', () => {
    const dir = temp()
    writeFileSync(join(dir, 'file'), '')
    expect(() => cachePut(digest, data, join(dir, 'file'))).not.toThrow()
  })

  it('locates the directory from the environment', () => {
    expect(cacheDir({ MICELIO_CACHE_DIR: '/x' })).toBe('/x/themes')
    expect(cacheDir({ XDG_CACHE_HOME: '/y' })).toBe('/y/micelio/themes')
    expect(cacheDir({})).toMatch(/\.cache\/micelio\/themes$/)
  })
})

describe('text from a package', () => {
  it('is printed without control characters and cut short', () => {
    expect(safeText('a\u001B[31mb\nc')).toBe('a [31mb c')
    expect(safeText('x'.repeat(500))).toHaveLength(200)
  })
})

describe('installing an unpacked theme', () => {
  const manifest = (fields: Record<string, unknown> = {}): string => JSON.stringify({ id: 'sample', name: 'Sample', version: '1.0.0', contract: 2, ...fields })

  function unpacked(files: Record<string, string>): ReturnType<typeof unpackTheme> {
    const data = packageOf(files)
    return unpackTheme(data, { digest: `sha256:${createHash('sha256').update(data).digest('hex')}` })
  }
  const pin: ThemePin = { id: 'sample', version: '1.0.0', digest: DIGEST }

  it('accepts a package that is the theme the pin names', () => {
    expect(checkIdentity(pin, unpacked({ 'theme.json': manifest() }))).toEqual({ contract: '2.0' })
    expect(checkIdentity(pin, unpacked({ 'theme.json': manifest({ contract: '2.0' }) }))).toEqual({ contract: '2.0' })
  })

  it.each([
    ['another id', { id: 'other' }, 'identity'],
    ['another version', { version: '1.0.1' }, 'identity'],
    ['a newer minor', { contract: '2.1' }, 'contract'],
    ['another major', { contract: 3 }, 'contract'],
    ['no contract', { contract: undefined }, 'contract'],
  ])('refuses a package with %s', (_name, fields, expected) => {
    const error = failure(() => checkIdentity(pin, unpacked({ 'theme.json': manifest(fields) })))
    expect(error.failure).toBe(expected)
    expect(error.message).toContain('sample@1.0.0')
    expect(error.message).toContain(DIGEST)
  })

  it('writes the files and replaces an earlier install', () => {
    const root = temp()
    mkdirSync(join(root, 'sample'))
    writeFileSync(join(root, 'sample', 'old.css'), 'old')
    const dir = writeTheme(root, 'sample', unpacked({ 'theme.json': manifest(), 'theme.css': 'a{}', 'i18n/en.json': '{}' }))
    expect(dir).toBe(join(root, 'sample'))
    expect(readdirSync(dir).sort()).toEqual(['i18n', 'theme.css', 'theme.json'])
    expect(readFileSync(join(dir, 'i18n/en.json'), 'utf8')).toBe('{}')
    expect(readdirSync(root)).toEqual(['sample'])
  })

  it('leaves no staging folder when a write fails', () => {
    const root = temp()
    const result = unpacked({ 'theme.json': manifest() })
    result.files.set('theme.json/inner', new Uint8Array())
    expect(() => writeTheme(root, 'sample', result)).toThrow()
    expect(readdirSync(root)).toEqual([])
  })

  it('prunes what is not locked, staging folders included', () => {
    const root = temp()
    for (const name of ['keep', 'gone', '.keep.abc123.tmp']) mkdirSync(join(root, name))
    expect(pruneThemes(root, new Set(['keep'])).sort()).toEqual(['.keep.abc123.tmp', 'gone'])
    expect(readdirSync(root)).toEqual(['keep'])
    expect(pruneThemes(join(root, 'missing'), new Set())).toEqual([])
  })

  it('refuses a path that would leave the folder, even if the unpack let it through', () => {
    const root = temp()
    const result = unpacked({ 'theme.json': manifest() })
    result.files.set('../escape', new Uint8Array())
    expect(failure(() => writeTheme(root, 'sample', result)).failure).toBe('identity')
    expect(readdirSync(root)).toEqual([])
  })
})
