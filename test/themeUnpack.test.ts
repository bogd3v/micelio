import { afterEach, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { gzipSync } from 'node:zlib'
import { UnpackError } from '../modules/theme/registry/error'
import { extractTheme } from '../modules/theme/registry/extract'
import { isAllowedPath, isCodePath, pathProblem, splitUstarPath } from '../modules/theme/registry/paths'
import { readTar, writeTar } from '../modules/theme/registry/tar'
import { unpackOwnTheme, unpackTheme as unpackPinned } from '../modules/theme/registry/unpack'
import type { UnpackOptions, UnpackRule } from '../modules/theme/registry/types'
import { AVIF, GIF, JPG, noise, packageOf, PNG, rawEntry, rawTar, tgz, THEME_JSON_TEXT, WEBP, WOFF2 } from './fixtures/tar'
import type { RawEntry } from './fixtures/tar'

// The tar and gzip here are built by hand (test/fixtures/tar.ts), not by the packer

/** Unpacks with the digest of the bytes as the pin, which `unpackTheme` requires; a test that wants another digest passes it. */
function unpackTheme(data: Uint8Array, options: Partial<UnpackOptions> = {}): ReturnType<typeof unpackPinned> {
  return unpackPinned(data, { digest: `sha256:${createHash('sha256').update(data).digest('hex')}`, ...options })
}

function rule(run: () => unknown): { rule: UnpackRule, path: string | null } {
  try {
    run()
  } catch (error) {
    if (error instanceof UnpackError) return { rule: error.rule, path: error.path }
    throw error
  }
  throw new Error('expected an UnpackError')
}

function pack(entries: RawEntry[]): Buffer {
  return tgz(rawTar([{ name: 'theme.json', data: THEME_JSON_TEXT }, ...entries]))
}

function rejects(entries: RawEntry[], expected: UnpackRule, path?: string): void {
  const got = rule(() => unpackTheme(pack(entries)))
  expect(got.rule).toBe(expected)
  if (path !== undefined) expect(got.path).toBe(path)
}

describe('what is accepted', () => {
  it('unpacks a data-only package', () => {
    const result = unpackTheme(packageOf({ 'theme.css': 'a{}', 'fonts/x.woff2': WOFF2, 'images/hero/a.png': PNG, 'i18n/en.json': '{}' }))
    expect([...result.files.keys()]).toEqual(['theme.json', 'theme.css', 'fonts/x.woff2', 'images/hero/a.png', 'i18n/en.json'])
    expect(result.code).toBe(false)
    expect(result.size).toBe(THEME_JSON_TEXT.length + 3 + WOFF2.length + PNG.length + 2)
    expect(result.digest).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  it.each(['slots/ThemeMark.vue', 'slots/a.css', 'slots/helper.ts', 'templates/page.html'])('says %s makes a code package', (path) => {
    expect(unpackTheme(packageOf({ [path]: 'x' })).code).toBe(true)
  })

  it('accepts directory entries of the allowed folders', () => {
    const entries: RawEntry[] = [{ name: 'slots/', type: '5', mode: 0o755 }, { name: 'images/hero', type: '5', mode: 0o755 }, { name: 'images/hero/a.gif', data: GIF }]
    expect(unpackTheme(pack(entries)).files.has('images/hero/a.gif')).toBe(true)
  })

  it.each([['a.woff2', WOFF2], ['a.png', PNG], ['a.jpg', JPG], ['a.jpeg', JPG], ['a.gif', GIF], ['a.webp', WEBP], ['a.avif', AVIF]] as const)('accepts the magic of %s', (name, data) => {
    expect(unpackTheme(packageOf({ [`${name.endsWith('woff2') ? 'fonts' : 'images'}/${name}`]: data })).files.size).toBe(2)
  })

  it('accepts an inert svg', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="a"/></defs><rect fill="url(#a)"/><use href="#a"/></svg>'
    expect(unpackTheme(packageOf({ 'images/a.svg': svg })).files.has('images/a.svg')).toBe(true)
  })
})

describe('the allowlist', () => {
  it.each(['extra.txt', 'package.json', 'fonts/a.woff', 'fonts/sub/a.woff2', 'images/a.exe', 'i18n/en.txt', 'slots/sub/a.vue', 'slots/a.js', 'templates/sub/a', 'node_modules/x'])('rejects %s, naming it', (path) => {
    rejects([{ name: path, data: 'x' }], 'allowlist', path)
  })

  it('rejects a folder outside the list', () => {
    rejects([{ name: 'other/', type: '5', mode: 0o755 }], 'allowlist', 'other')
  })

  it.each(['SLOTS/x.VUE', 'slots/x.Ts', 'Fonts/a.woff2', 'images/a.PNG.js'])('rejects %s, which is outside the allowlist', (path) => {
    rejects([{ name: path, data: 'x' }], 'allowlist', path)
  })

  it('decides code from the path, in any case', () => {
    for (const path of ['SLOTS/x.VUE', 'slots/x.Ts', 'Templates/a', 'a/b.MJS', 'x.WASM', 'a.cjs', 'a.mts', 'a.cts', 'a.jsx', 'a.tsx', 'images/a.JS']) expect(isCodePath(path)).toBe(true)
    for (const path of ['theme.css', 'images/a.png', 'fonts/a.woff2', 'i18n/en.json']) expect(isCodePath(path)).toBe(false)
  })

  it('matches folder names in lowercase only', () => {
    expect(isAllowedPath('slots/a.vue', 'file')).toBe(true)
    expect(isAllowedPath('Slots/a.vue', 'file')).toBe(false)
    expect(isAllowedPath('Images', 'directory')).toBe(false)
  })

  it('requires theme.json', () => {
    expect(rule(() => unpackTheme(tgz(rawTar([{ name: 'theme.css', data: 'a{}' }]))))).toEqual({ rule: 'missing', path: 'theme.json' })
  })
})

describe('entry types and modes', () => {
  it.each([['2', 'symlink'], ['1', 'hard link'], ['3', 'character device'], ['4', 'block device'], ['6', 'FIFO'], ['7', 'contiguous'], ['S', 'sparse'], ['x', 'pax'], ['g', 'pax global'], ['L', 'GNU long name'], ['K', 'GNU long link']])('rejects type %s (%s)', (type) => {
    rejects([{ name: 'theme.css', type, data: type === 'x' || type === 'L' ? '14 path=../x\n' : '', linkname: type === '1' || type === '2' ? 'theme.json' : '' }], 'entry-type')
  })

  it('rejects a pax path that would escape, by refusing the header', () => {
    rejects([{ name: 'PaxHeader', type: 'x', data: '20 path=../../evil\n' }, { name: 'theme.css', data: 'a{}' }], 'entry-type')
  })

  it('rejects an unknown type flag', () => {
    rejects([{ name: 'theme.css', type: 'Z' }], 'entry-type')
  })

  it.each([0o755, 0o744, 0o641, 0o4644, 0o2644])('rejects the mode %s of a file', (mode) => {
    rejects([{ name: 'theme.css', data: 'a{}', mode }], 'mode', 'theme.css')
  })

  it('rejects a link name on a file', () => {
    rejects([{ name: 'theme.css', data: 'a{}', linkname: 'x' }], 'entry-type')
  })

  it('rejects a header that is not ustar', () => {
    rejects([{ name: 'theme.css', data: 'a{}', magic: 'ustar  \0' }], 'tar')
  })

  it('rejects a bad checksum', () => {
    const tar = rawTar([{ name: 'theme.json', data: THEME_JSON_TEXT }])
    tar.writeUInt8(tar.readUInt8(0) ^ 1, 0)
    expect(rule(() => unpackTheme(tgz(tar))).rule).toBe('tar')
  })

  it('rejects a directory with a size', () => {
    rejects([{ name: 'slots', type: '5', mode: 0o755, size: 5 }], 'tar')
  })
})

describe('paths', () => {
  it.each([
    ['../evil.css'], ['images/../../evil.png'], ['/etc/passwd'], ['./theme.css'], ['a//b.css'], ['images/./a.png'],
    ['.env'], ['images/.hidden.png'], ['.git/config'], ['images/a.png.'], ['con.css'], ['images/CON.png'], ['images/nul'], ['images/Lpt1.svg'],
    ['images/aux.tar.png'], ['com9.css'], ['com0.css'], ['images/LPT0'], ['lpt9.png'], ['images/a b.png'], ['images/a\\b.png'], ['images/a:b.png'],
  ])('rejects the path %s', (path) => {
    rejects([{ name: path, data: 'x' }], 'path', path)
  })

  it('rejects a name that ends with a dot next to the one without', () => {
    rejects([{ name: 'images/a', type: '5', mode: 0o755 }, { name: 'images/a.', type: '5', mode: 0o755 }], 'path', 'images/a.')
  })

  it('rejects a non-ASCII name', () => {
    rejects([{ name: 'images/é.png', data: PNG }], 'path')
  })

  it('rejects a file whose name ends with a slash', () => {
    rejects([{ name: 'theme.css/', data: 'x' }], 'path')
  })

  it('rejects a path deeper than 8 levels, and takes 8', () => {
    expect(unpackTheme(pack([{ name: 'images/a/b/c/d/e/f/g.png', data: PNG }])).files.size).toBe(2)
    rejects([{ name: 'images/a/b/c/d/e/f/g/h.png', data: PNG }], 'depth')
  })

  it('rejects a segment over 100 bytes with the length rule, not a crash', () => {
    // A tar cannot carry such a name, so only the rule is checked (the packer reports it as a PackError line)
    expect(pathProblem(`images/${'a'.repeat(150)}.png`)?.rule).toBe('path-length')
  })

  it('rejects a path under 200 bytes that no name and prefix split can hold', () => {
    const path = `images/${'a'.repeat(83)}/${'b'.repeat(95)}/c.png`
    expect(Buffer.byteLength(path)).toBeLessThan(200)
    expect(pathProblem(path)?.rule).toBe('path-length')
  })

  it('writes and reads back a path over 100 bytes through the prefix field', () => {
    const path = `images/${'a'.repeat(90)}/${'b'.repeat(80)}.png`
    expect(Buffer.byteLength(path)).toBeGreaterThan(100)
    expect(splitUstarPath(path)?.prefix.length).toBeGreaterThan(0)
    const entries = readTar(writeTar([{ path, data: PNG }]))
    expect(entries.map(entry => entry.path)).toEqual([path])
    expect(Buffer.from(entries[0]?.data ?? []).equals(PNG)).toBe(true)
  })

  it('rejects a path over 200 bytes', () => {
    const path = `images/${'a'.repeat(90)}/${'b'.repeat(90)}.png`
    expect(Buffer.byteLength(path)).toBe(192)
    expect(unpackTheme(pack([{ name: path, data: PNG }])).files.has(path)).toBe(true)
    rejects([{ name: `images/${'a'.repeat(100)}/${'b'.repeat(95)}.png`, data: PNG }], 'path-length')
  })

  it('refuses a name that fills the field with bytes after a NUL', () => {
    const entry = rawEntry({ name: 'theme.css', data: 'a{}' })
    entry.write('x', 20)
    const sum = Buffer.from(entry.subarray(0, 512)).fill(0x20, 148, 156).reduce((a, b) => a + b, 0)
    entry.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 'latin1')
    expect(rule(() => unpackTheme(tgz(Buffer.concat([rawEntry({ name: 'theme.json', data: THEME_JSON_TEXT }), entry, Buffer.alloc(1024)])))).rule).toBe('tar')
  })
})

describe('duplicates', () => {
  it.each([
    [['theme.css', 'theme.css']],
    [['images/a.png', 'images/A.PNG']],
    [['theme.css', 'THEME.CSS']],
    [['images/a.png', 'images/a.png/b.png']],
    [['fonts/a.txt', 'fonts/ａ.txt']],
  ])('rejects %j', (names) => {
    const rejected = rule(() => unpackTheme(pack(names.map(name => ({ name, data: PNG })))))
    expect(['duplicate', 'path']).toContain(rejected.rule)
  })

  it('rejects the same name after case folding with a file path', () => {
    rejects([{ name: 'images/a.png', data: PNG }, { name: 'images/A.png', data: PNG }], 'duplicate', 'images/A.png')
  })

  it('rejects a file next to a folder of the same name', () => {
    rejects([{ name: 'images/a', type: '5', mode: 0o755 }, { name: 'images/a', data: 'x' }], 'duplicate')
  })
})

describe('caps', () => {
  it('refuses a .tgz over 2 MiB before inflating it', () => {
    expect(rule(() => unpackTheme(Buffer.alloc(2 * 1024 * 1024 + 1)))).toEqual({ rule: 'compressed-size', path: null })
  })

  it('refuses a file over 1 MiB, and takes 1 MiB', () => {
    expect(unpackTheme(pack([{ name: 'theme.css', data: noise(1024 * 1024) }])).files.get('theme.css')?.length).toBe(1024 * 1024)
    rejects([{ name: 'theme.css', data: noise(1024 * 1024 + 1) }], 'file-size', 'theme.css')
  })

  it('refuses more than 4 MiB unpacked', () => {
    const files = Array.from({ length: 5 }, (_, i) => ({ name: `images/n${i}.svg`, data: noise(838_862, i + 1) }))
    expect(rule(() => unpackTheme(pack(files))).rule).toBe('unpacked-size')
  })

  it('refuses more than 200 entries, directories included, and takes 200', () => {
    const files = (count: number): RawEntry[] => Array.from({ length: count }, (_, i) => ({ name: `images/i${i}`, type: '5', mode: 0o755 }))
    expect(unpackTheme(pack(files(199))).files.size).toBe(1)
    expect(rule(() => unpackTheme(pack(files(200)))).rule).toBe('entries')
  })

  it('aborts a decompression bomb by its ratio', () => {
    const bomb = pack([{ name: 'theme.css', data: Buffer.alloc(1024 * 1024) }])
    expect(bomb.length).toBeLessThan(2000)
    expect(rule(() => unpackTheme(bomb)).rule).toBe('ratio')
  })

  it('refuses a tar over the size a package can reach, such as junk after the end marker', () => {
    const tar = Buffer.concat([rawTar([{ name: 'theme.json', data: THEME_JSON_TEXT }]), noise(4 * 1024 * 1024 + 256 * 1024)])
    const packed = tgz(tar)
    expect(packed.length).toBeLessThan(2 * 1024 * 1024)
    expect(rule(() => unpackTheme(packed))).toEqual({ rule: 'unpacked-size', path: null })
  })

  it('caps theme.json in bytes and nesting', () => {
    expect(rule(() => unpackTheme(packageOf({ 'theme.json': `{"a":"${noise(256 * 1024).toString()}"}` }))).rule).toBe('json')
    expect(rule(() => unpackTheme(packageOf({ 'theme.json': `${'['.repeat(17)}${']'.repeat(17)}` }))).rule).toBe('json')
    expect(unpackTheme(packageOf({ 'theme.json': `${'['.repeat(16)}${']'.repeat(16)}` })).files.size).toBe(1)
    expect(rule(() => unpackTheme(packageOf({ 'theme.json': '{"a":' }))).rule).toBe('json')
    expect(rule(() => unpackTheme(packageOf({ 'i18n/en.json': '['.repeat(17) + ']'.repeat(17) }))).rule).toBe('json')
  })

  it('does not count brackets inside strings as nesting', () => {
    expect(unpackTheme(packageOf({ 'theme.json': `{"a":"${'['.repeat(40)}\\"${'['.repeat(40)}"}` })).files.size).toBe(1)
  })
})

describe('the gzip and tar framing', () => {
  const good = (): Buffer => packageOf()

  it('fails on bytes after the member', () => {
    expect(rule(() => unpackTheme(Buffer.concat([good(), Buffer.from('x')]))).rule).toBe('trailing-data')
  })

  it('fails on a second gzip member', () => {
    expect(rule(() => unpackTheme(Buffer.concat([good(), good()]))).rule).toBe('trailing-data')
  })

  it('fails on data after the end-of-archive marker', () => {
    const tar = Buffer.concat([rawTar([{ name: 'theme.json', data: THEME_JSON_TEXT }]), rawEntry({ name: 'theme.css', data: 'a{}' })])
    expect(rule(() => unpackTheme(tgz(tar))).rule).toBe('trailing-data')
  })

  it('fails without an end marker or with one zero block', () => {
    expect(rule(() => unpackTheme(tgz(rawTar([{ name: 'theme.json', data: THEME_JSON_TEXT }], Buffer.alloc(0))))).rule).toBe('tar')
    expect(rule(() => unpackTheme(tgz(rawTar([{ name: 'theme.json', data: THEME_JSON_TEXT }], Buffer.alloc(512))))).rule).toBe('tar')
  })

  it('fails on a truncated tar entry', () => {
    const tar = rawTar([{ name: 'theme.json', data: THEME_JSON_TEXT, size: 5000 }], Buffer.alloc(0))
    expect(rule(() => unpackTheme(tgz(tar))).rule).toBe('tar')
  })

  it('fails on a gzip header with flags, a bad checksum or garbage', () => {
    const named = Buffer.from(good())
    named[3] = 0x08
    expect(rule(() => unpackTheme(named)).rule).toBe('gzip')
    const bad = Buffer.from(good())
    bad.writeUInt8(bad.readUInt8(bad.length - 8) ^ 1, bad.length - 8)
    expect(rule(() => unpackTheme(bad)).rule).toBe('gzip')
    expect(rule(() => unpackTheme(Buffer.from('not a package at all'))).rule).toBe('gzip')
    expect(rule(() => unpackTheme(Buffer.alloc(0))).rule).toBe('gzip')
  })

  it('fails on a deflate stream that is cut', () => {
    expect(rule(() => unpackTheme(good().subarray(0, 40))).rule).toBe('gzip')
  })

  it('reads a member made by the plain gzip of Node at another level', () => {
    expect(unpackTheme(gzipSync(rawTar([{ name: 'theme.json', data: THEME_JSON_TEXT }]), { level: 1 })).files.size).toBe(1)
  })
})

describe('file contents', () => {
  it.each([
    ['fonts/a.woff2', 'nope'], ['images/a.png', JPG], ['images/a.jpg', PNG], ['images/a.gif', 'GIF'], ['images/a.webp', 'RIFF0000WEBX'],
    ['images/a.avif', Buffer.concat([Buffer.from([0, 0, 0, 0x10]), Buffer.from('ftypmp42'), Buffer.alloc(4)])], ['images/a.webp', ''],
  ])('rejects %s with the wrong magic bytes', (path, data) => {
    rejects([{ name: path, data }], 'magic', path)
  })

  it('accepts avif by its major brand or a compatible brand, and refuses one with neither', () => {
    const ftyp = (major: string, compatible: string[]): Buffer => {
      const body = Buffer.from(`ftyp${major}\0\0\0\0${compatible.join('')}`, 'latin1')
      const head = Buffer.alloc(4)
      head.writeUInt32BE(body.length + 4)
      return Buffer.concat([head, body])
    }
    expect(unpackTheme(packageOf({ 'images/a.avif': ftyp('avif', []) })).files.size).toBe(2)
    expect(unpackTheme(packageOf({ 'images/a.avif': ftyp('avis', []) })).files.size).toBe(2)
    expect(unpackTheme(packageOf({ 'images/a.avif': ftyp('mif1', ['miaf', 'avif']) })).files.size).toBe(2)
    expect(unpackTheme(packageOf({ 'images/a.avif': ftyp('msf1', ['avis']) })).files.size).toBe(2)
    rejects([{ name: 'images/a.avif', data: ftyp('mif1', ['miaf', 'heic']) }], 'magic', 'images/a.avif')
    const lying = ftyp('mif1', ['avif'])
    lying.writeUInt32BE(16, 0)
    rejects([{ name: 'images/a.avif', data: lying }], 'magic')
  })

  it('rejects an svg through the unpack, naming it', () => {
    rejects([{ name: 'images/a.svg', data: '<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>' }], 'svg', 'images/a.svg')
    rejects([{ name: 'images/a.svg', data: Buffer.from([0x3C, 0xFF, 0xFE, 0x3E]) }], 'svg')
  })
})

describe('names that are members of Object', () => {
  it.each(['templates/a.constructor', 'templates/a.__proto__', 'images/constructor.png', 'templates/toString', 'fonts/__proto__.woff2'])('does not throw a TypeError for %s', (path) => {
    try {
      unpackTheme(packageOf({ [path]: WOFF2 }))
    } catch (error) {
      expect(error).toBeInstanceOf(UnpackError)
    }
  })

  it('treats an extension that is a member of Object as an unknown extension', () => {
    expect(unpackTheme(packageOf({ 'templates/a.constructor': 'x', 'templates/b.__proto__': 'x', 'templates/c.toString': 'x' })).code).toBe(true)
  })
})

describe('who may skip the pinned digest', () => {
  function sources(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? sources(join(dir, entry.name)) : /\.(?:ts|mts|mjs|vue)$/.test(entry.name) ? [join(dir, entry.name)] : [])
  }

  it('is imported by the packer and the tests only', () => {
    const importers = ['app', 'server', 'modules', 'scripts'].flatMap(dir => sources(join(process.cwd(), dir))).filter(file => readFileSync(file, 'utf8').includes('unpackOwnTheme'))
    expect(importers.map(file => relative(process.cwd(), file)).sort()).toEqual(['modules/theme/registry/build.ts', 'modules/theme/registry/unpack.ts'].filter(file => existsSync(join(process.cwd(), file))))
  })
})

describe('JSON keys', () => {
  it.each(['{"__proto__":{"x":1}}', '{"a":[{"b":{"constructor":1}}]}', '{"prototype":null}'])('rejects %s in any JSON file', (json) => {
    rejects([{ name: 'i18n/en.json', data: json }], 'json', 'i18n/en.json')
    expect(rule(() => unpackTheme(packageOf({ 'theme.json': json }))).rule).toBe('json')
  })

  it('accepts a value that is the word, and a similar key', () => {
    expect(unpackTheme(packageOf({ 'i18n/en.json': '{"proto":"__proto__","constructors":1}' })).files.size).toBe(2)
  })
})

describe('the digest and the manifest', () => {
  const files = { 'theme.json': THEME_JSON_TEXT, 'theme.css': 'a{color:red}', 'images/a.png': PNG as Uint8Array }
  const sha = (data: string | Uint8Array): string => createHash('sha256').update(data).digest('hex')
  const manifestOf = (over: Record<string, unknown> = {}): string => JSON.stringify({
    id: 'sample', version: '1.0.0', code: false,
    files: Object.entries(files).map(([path, data]) => ({ path, size: Buffer.byteLength(data), sha256: sha(data) })),
    ...over,
  })

  it('checks the files against a manifest that matches', () => {
    expect(unpackTheme(packageOf(files), { manifest: manifestOf() }).files.size).toBe(3)
  })

  it('rejects a tampered file by its sha256', () => {
    const tampered = packageOf({ ...files, 'theme.css': 'a{color:blu}' })
    expect(rule(() => unpackTheme(tampered, { manifest: manifestOf() }))).toEqual({ rule: 'manifest', path: 'theme.css' })
  })

  it('rejects a file whose size differs, one added and one missing', () => {
    expect(rule(() => unpackTheme(packageOf({ ...files, 'theme.css': 'longer' }), { manifest: manifestOf() })).path).toBe('theme.css')
    expect(rule(() => unpackTheme(packageOf({ ...files, 'theme.css': 'a{color:red}', 'sections.css': 'b{}' }), { manifest: manifestOf() }))).toEqual({ rule: 'manifest', path: 'sections.css' })
    const { 'images/a.png': _gone, ...fewer } = files
    expect(rule(() => unpackTheme(packageOf(fewer), { manifest: manifestOf() }))).toEqual({ rule: 'manifest', path: 'images/a.png' })
  })

  it('rejects a manifest that lies about code, id or version, or is malformed', () => {
    expect(rule(() => unpackTheme(packageOf(files), { manifest: manifestOf({ code: true }) })).rule).toBe('manifest')
    expect(rule(() => unpackTheme(packageOf(files), { manifest: manifestOf({ id: 'other' }) })).rule).toBe('manifest')
    expect(rule(() => unpackTheme(packageOf(files), { manifest: manifestOf({ version: '2.0.0' }) })).rule).toBe('manifest')
    expect(rule(() => unpackTheme(packageOf(files), { manifest: '{}' })).rule).toBe('manifest')
    expect(rule(() => unpackTheme(packageOf(files), { manifest: '{"files":[1]}' })).rule).toBe('manifest')
    expect(rule(() => unpackTheme(packageOf(files), { manifest: '[' })).rule).toBe('json')
  })

  it('does not depend on the manifest: it says code false for a package with slots', () => {
    const withSlot = { ...files, 'slots/ThemeMark.vue': '<template/>' }
    expect(unpackTheme(packageOf(withSlot)).code).toBe(true)
    expect(rule(() => unpackTheme(packageOf(withSlot), { manifest: manifestOf() })).rule).toBe('manifest')
  })

  it('requires the pinned digest at the entry point, and not for the packer\'s own check', () => {
    const data = packageOf(files)
    // @ts-expect-error the digest is a required option
    expect(rule(() => unpackPinned(data, {})).rule).toBe('digest')
    // @ts-expect-error the options are required
    expect(rule(() => unpackPinned(data)).rule).toBe('digest')
    expect(unpackOwnTheme(data).files.size).toBe(3)
  })

  it('rejects a manifest that lists a path twice', () => {
    const [first] = JSON.parse(manifestOf()).files as unknown[]
    const doubled = JSON.stringify({ ...JSON.parse(manifestOf()), files: [first, ...JSON.parse(manifestOf()).files] })
    expect(rule(() => unpackTheme(packageOf(files), { manifest: doubled })).rule).toBe('manifest')
  })

  it('does not accept a manifest and a theme.json that both lack an id or a version', () => {
    const bare = { 'theme.json': '{}', 'theme.css': 'a{}' }
    const listed = Object.entries(bare).map(([path, data]) => ({ path, size: data.length, sha256: sha(data) }))
    expect(rule(() => unpackTheme(packageOf(bare), { manifest: JSON.stringify({ code: false, files: listed }) })).rule).toBe('manifest')
  })

  it('requires code to be a boolean', () => {
    expect(rule(() => unpackTheme(packageOf(files), { manifest: manifestOf({ code: 'false' }) })).rule).toBe('manifest')
    expect(rule(() => unpackTheme(packageOf(files), { manifest: manifestOf({ code: undefined }) })).rule).toBe('manifest')
  })

  it('verifies the expected digest of the .tgz before inflating', () => {
    const data = packageOf(files)
    const digest = `sha256:${sha(data)}`
    expect(unpackTheme(data, { digest }).digest).toBe(digest)
    expect(rule(() => unpackTheme(data, { digest: `sha256:${'0'.repeat(64)}` })).rule).toBe('digest')
    expect(rule(() => unpackTheme(data, { digest: 'sha256:ABC' })).rule).toBe('digest')
  })
})

describe('extractTheme', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })
  function fresh(): string {
    const dir = mkdtempSync(join(tmpdir(), 'micelio-unpack-'))
    dirs.push(dir)
    return dir
  }

  it('writes the files into a new folder, private to the owner', () => {
    const target = join(fresh(), 'theme')
    extractTheme(unpackTheme(packageOf({ 'images/hero/a.png': PNG })).files, target)
    expect(readFileSync(join(target, 'theme.json'), 'utf8')).toBe(THEME_JSON_TEXT)
    expect(readFileSync(join(target, 'images/hero/a.png')).equals(PNG)).toBe(true)
    expect(statSync(join(target, 'theme.json')).mode & 0o777).toBe(0o600)
  })

  it('refuses a folder that exists', () => {
    expect(() => extractTheme(new Map(), fresh())).toThrow(/EEXIST/)
  })

  it('refuses a path that escapes, writing nothing outside', () => {
    const parent = fresh()
    const target = join(parent, 'theme')
    expect(rule(() => extractTheme(new Map([['../evil.css', new Uint8Array(1)]]), target)).rule).toBe('path')
    expect(rule(() => extractTheme(new Map([['/abs.css', new Uint8Array(1)]]), join(parent, 'other'))).rule).toBe('path')
    expect(existsSync(join(parent, 'evil.css'))).toBe(false)
  })
})
