import { afterEach, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { renameSync, lstatSync, chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, truncateSync, utimesSync, writeFileSync, linkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { spawnSync } from 'node:child_process'
import { gunzipSync } from 'node:zlib'
import { loadHooks } from '../modules/theme/hooks'
import { buildPackage, readPackageFile, writePackage } from '../modules/theme/registry/build'
import { PackError } from '../modules/theme/registry/error'
import { unpackOwnTheme, unpackTheme } from '../modules/theme/registry/unpack'
import { discoverThemes } from '../modules/theme/themes'
import type { InstalledTheme } from '../modules/theme/types'
import { noise, PNG } from './fixtures/tar'

const ROOT = process.cwd()
const hooks = loadHooks(join(ROOT, 'app'))
const FIXTURES = join(ROOT, 'test/fixtures/themes')

function installed(id: string): InstalledTheme {
  const found = discoverThemes([join(ROOT, 'themes')]).find(theme => theme.id === id)
  if (!found) throw new Error(`theme ${id} is not installed`)
  return found
}

function filesOf(dir: string, prefix = ''): string[] {
  return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? filesOf(dir, `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`]).sort()
}

describe.each(['starter'])('packing %s', (id) => {
  const theme = installed(id)

  it('gives the same bytes and digest twice', () => {
    const first = buildPackage(theme, hooks)
    const second = buildPackage(theme, hooks)
    expect(first.tgz.equals(second.tgz)).toBe(true)
    expect(first.digest).toBe(second.digest)
    expect(first.digest).toBe(`sha256:${createHash('sha256').update(first.tgz).digest('hex')}`)
  })

  it('packs the folder as it is, with no file moved or renamed', () => {
    const built = buildPackage(theme, hooks)
    expect(built.manifest.files.map(file => file.path)).toEqual(filesOf(theme.dir))
    expect(built.tgzName).toBe(`${id}-0.1.0.tgz`)
    expect(built.manifestName).toBe(`${id}-0.1.0.manifest.json`)
  })

  it('carries its own license', () => {
    const paths = buildPackage(theme, hooks).manifest.files.map(file => file.path)
    expect(paths).toContain('LICENSE')
    expect(readFileSync(join(theme.dir, 'LICENSE'), 'utf8')).toContain('Permission is hereby granted, free of charge')
  })

  it('says it has code (slots)', () => {
    expect(buildPackage(theme, hooks).manifest.code).toBe(true)
  })

  it('writes a manifest with the files, their sha256 and the check summary', () => {
    const { manifest } = buildPackage(theme, hooks)
    expect(manifest).toMatchObject({ id, name: theme.manifest.name, version: '0.1.0', contract: { declared: '2.0', used: '2.0' }, check: { errors: 0 } })
    expect(manifest.license).toBe(theme.manifest.license)
    expect(manifest.size).toBe(manifest.files.reduce((sum, file) => sum + file.size, 0))
    for (const file of manifest.files) expect(file.sha256).toBe(createHash('sha256').update(readFileSync(join(theme.dir, file.path))).digest('hex'))
  })

  it('is accepted by the unpack, with and without the manifest', () => {
    const built = buildPackage(theme, hooks)
    const plain = unpackTheme(built.tgz, { digest: built.digest })
    expect(plain.code).toBe(true)
    expect(unpackTheme(built.tgz, { digest: built.digest, manifest: JSON.stringify(built.manifest) }).files.size).toBe(built.manifest.files.length)
    for (const [path, data] of plain.files) expect(Buffer.from(data).equals(readFileSync(join(theme.dir, path)))).toBe(true)
  })

  it('carries the license texts of its fonts', () => {
    const paths = buildPackage(theme, hooks).manifest.files.map(file => file.path)
    for (const font of theme.manifest.fonts ?? []) expect(paths.some(path => path.startsWith('fonts/') && path.endsWith('.txt') && /OFL/.test(path)), font.file).toBe(true)
    expect(paths.includes('README.md') || paths.includes('LICENSE')).toBe(true)
  })
})

describe('determinism', () => {
  const scratch: string[] = []
  afterEach(() => {
    for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  function dataOnlyCopy(): InstalledTheme {
    const root = mkdtempSync(join(tmpdir(), 'micelio-det-'))
    scratch.push(root)
    cpSync(join(FIXTURES, 'data-only'), join(root, 'data-only'), { recursive: true })
    return discoverThemes([root])[0] as InstalledTheme
  }

  it('does not depend on the time or the mode of the files on disk', () => {
    const original = buildPackage(discoverThemes([FIXTURES]).find(theme => theme.id === 'data-only') as InstalledTheme, hooks)
    const copy = dataOnlyCopy()
    for (const file of readdirSync(copy.dir)) {
      chmodSync(join(copy.dir, file), 0o755)
      utimesSync(join(copy.dir, file), new Date('2001-02-03T04:05:06Z'), new Date('2007-08-09T10:11:12Z'))
    }
    const touched = buildPackage(copy, hooks)
    expect(touched.digest).toBe(original.digest)
    expect(touched.tgz.equals(original.tgz)).toBe(true)
  })

  it('writes a gzip header without a timestamp and tar headers with fixed owner, time and mode', () => {
    const { tgz } = buildPackage(installed('starter'), hooks)
    expect([...tgz.subarray(0, 10)]).toEqual([0x1F, 0x8B, 0x08, 0x00, 0, 0, 0, 0, 0x00, 0x03])
    const tar = gunzipSync(tgz)
    let offset = 0
    let headers = 0
    while (offset + 512 <= tar.length && tar.subarray(offset, offset + 512).some(byte => byte !== 0)) {
      const header = tar.subarray(offset, offset + 512)
      expect(header.toString('latin1', 100, 107)).toBe('0000644')
      expect(header.toString('latin1', 108, 115)).toBe('0000000')
      expect(header.toString('latin1', 116, 123)).toBe('0000000')
      expect(header.toString('latin1', 136, 147)).toBe('00000000000')
      expect(header.toString('latin1', 265, 297).replace(/\0/g, '')).toBe('')
      offset += 512 + Math.ceil(Number.parseInt(header.toString('latin1', 124, 135), 8) / 512) * 512
      headers += 1
    }
    expect(headers).toBe(12)
  })
})

describe('reading a file of a theme', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })
  function folder(): string {
    const dir = mkdtempSync(join(tmpdir(), 'micelio-read-'))
    dirs.push(dir)
    return dir
  }

  it('reads a regular file', () => {
    const dir = folder()
    writeFileSync(join(dir, 'a.css'), 'a{}')
    expect(readPackageFile(dir, 'a.css')).toEqual({ data: Buffer.from('a{}') })
  })

  it('refuses a symlink that appears where a file was listed', () => {
    const dir = folder()
    writeFileSync(join(dir, 'secret'), 'x')
    symlinkSync(join(dir, 'secret'), join(dir, 'a.css'))
    expect(readPackageFile(dir, 'a.css')).toEqual({ problem: 'a.css: is a symlink; copy the file instead' })
  })

  it('refuses a hard link', () => {
    const dir = folder()
    writeFileSync(join(dir, 'a.css'), 'x')
    linkSync(join(dir, 'a.css'), join(dir, 'b.css'))
    expect(readPackageFile(dir, 'b.css')).toEqual({ problem: expect.stringMatching(/b\.css: has 2 hard links/) })
  })

  it('refuses a directory, and a file that is too large without reading it', () => {
    const dir = folder()
    mkdirSync(join(dir, 'd'))
    expect(readPackageFile(dir, 'd')).toEqual({ problem: expect.stringMatching(/not a regular file|cannot be opened/) })
    writeFileSync(join(dir, 'big'), '')
    truncateSync(join(dir, 'big'), 2 * 1024 * 1024 * 1024)
    expect(readPackageFile(dir, 'big')).toEqual({ problem: expect.stringMatching(/file-size: big: is 2147483648 bytes/) })
  })

  it('refuses a file in a folder that is a symlink to outside the theme', () => {
    const outside = folder()
    writeFileSync(join(outside, 'x.png'), PNG)
    const dir = folder()
    symlinkSync(outside, join(dir, 'images'))
    expect(readPackageFile(dir, 'images/x.png')).toEqual({ problem: 'images/x.png: its folder resolves outside the theme folder' })
  })

  it('refuses a folder swapped for a symlink after the files were listed', () => {
    const outside = folder()
    writeFileSync(join(outside, 'x.png'), PNG)
    const dir = folder()
    mkdirSync(join(dir, 'images'))
    writeFileSync(join(dir, 'images/x.png'), PNG)
    const { dev, ino } = lstatSync(join(dir, 'images/x.png'), { bigint: true })
    expect(readPackageFile(dir, 'images/x.png', { dev, ino })).toHaveProperty('data')
    renameSync(join(dir, 'images'), join(dir, 'images-real'))
    symlinkSync(outside, join(dir, 'images'))
    expect(readPackageFile(dir, 'images/x.png', { dev, ino })).toHaveProperty('problem')
  })

  it('refuses a file replaced by another one after it was listed', () => {
    const dir = folder()
    writeFileSync(join(dir, 'a.css'), 'one')
    const { dev, ino } = lstatSync(join(dir, 'a.css'), { bigint: true })
    // The new file exists while the listed one does, so their inodes differ: after a remove, a file system may hand the freed inode out again.
    writeFileSync(join(dir, 'other'), 'two')
    expect(lstatSync(join(dir, 'other'), { bigint: true }).ino).not.toBe(ino)
    renameSync(join(dir, 'other'), join(dir, 'a.css'))
    expect(readPackageFile(dir, 'a.css', { dev, ino })).toEqual({ problem: expect.stringMatching(/a\.css: is not the file that was listed/) })
  })

  const fifo = spawnSync('mkfifo', ['--version'], { encoding: 'utf8' }).error ? 'mkfifo is not available on this system' : ''
  it.skipIf(fifo !== '')(`refuses a FIFO without blocking${fifo ? ` (skipped: ${fifo})` : ''}`, () => {
    const dir = folder()
    expect(spawnSync('mkfifo', [join(dir, 'pipe')]).status).toBe(0)
    expect(readPackageFile(dir, 'pipe')).toEqual({ problem: 'pipe: is not a regular file' })
  })

  it('refuses a file whose folder is not the one that was listed', () => {
    const dir = folder()
    mkdirSync(join(dir, 'images'))
    writeFileSync(join(dir, 'images/x.png'), PNG)
    const { dev, ino } = lstatSync(join(dir, 'images/x.png'), { bigint: true })
    expect(readPackageFile(dir, 'images/x.png', { dev, ino, folder: { dev, ino: ino + 1n } })).toEqual({ problem: expect.stringMatching(/its folder is not the one that was listed/) })
  })

  it('names a missing file', () => {
    expect(readPackageFile(folder(), 'gone')).toEqual({ problem: expect.stringMatching(/gone: cannot be opened \(ENOENT\)/) })
  })
})

describe('writing without following links', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })
  const built = (): ReturnType<typeof buildPackage> => buildPackage(installed('starter'), hooks)
  function repository(): string {
    const root = mkdtempSync(join(tmpdir(), 'micelio-link-'))
    dirs.push(root)
    return root
  }

  it('refuses a symlink at the path of the package or the manifest, leaving its target alone', () => {
    const root = repository()
    const target = join(root, 'target')
    writeFileSync(target, 'precious')
    const out = join(root, '.micelio/packages')
    mkdirSync(out, { recursive: true })
    symlinkSync(target, join(out, 'starter-0.1.0.tgz'))
    expect(() => writePackage(built(), root)).toThrow(/starter-0\.1\.0\.tgz is a symlink/)
    rmSync(join(out, 'starter-0.1.0.tgz'))
    symlinkSync(target, join(out, 'starter-0.1.0.manifest.json'))
    expect(() => writePackage(built(), root)).toThrow(/manifest\.json is a symlink/)
    expect(readFileSync(target, 'utf8')).toBe('precious')
  })

  it('refuses a .micelio that is a symlink to a folder outside the repository', () => {
    const root = repository()
    const outside = repository()
    symlinkSync(outside, join(root, '.micelio'))
    expect(() => writePackage(built(), root)).toThrow(/\.micelio is a symlink/)
    expect(readdirSync(outside)).toEqual([])
  })

  it('replaces a hard link instead of writing through it', () => {
    const root = repository()
    const outside = join(repository(), 'outside')
    writeFileSync(outside, 'precious')
    const out = join(root, '.micelio/packages')
    mkdirSync(out, { recursive: true })
    linkSync(outside, join(out, 'starter-0.1.0.tgz'))
    const package_ = built()
    writePackage(package_, root)
    expect(readFileSync(outside, 'utf8')).toBe('precious')
    expect(readFileSync(join(out, 'starter-0.1.0.tgz')).equals(package_.tgz)).toBe(true)
  })

  it('leaves no temporary or partial file when a write fails', () => {
    const root = repository()
    const out = join(root, '.micelio/packages')
    mkdirSync(join(out, 'starter-0.1.0.manifest.json'), { recursive: true })
    expect(() => writePackage(built(), root)).toThrow()
    expect(readdirSync(out).filter(name => name.endsWith('.tmp'))).toEqual([])
  })
})

describe('the command', () => {
  function run(...args: string[]): ReturnType<typeof spawnSync> {
    return spawnSync(join(ROOT, 'node_modules/.bin/jiti'), [join(ROOT, 'scripts/theme-pack.ts'), ...args], { encoding: 'utf8', cwd: ROOT })
  }

  it('prints the usage without an id', () => {
    const result = run()
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/Usage: npm run theme:pack -- <id>/)
  })

  it('names the installed themes for an unknown id', () => {
    const result = run('nope')
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/"nope" is not installed \(installed: starter[,)]/)
  })
})

describe('the size of the packages', () => {
  it('stays well under the caps', () => {
    for (const id of ['starter']) {
      const built = buildPackage(installed(id), hooks)
      expect(built.tgz.length).toBeLessThan(1024 * 1024)
      expect(built.manifest.size).toBeLessThan(2 * 1024 * 1024)
    }
  })
})

describe('a data-only theme', () => {
  it('says code false', () => {
    const built = buildPackage(discoverThemes([FIXTURES]).find(theme => theme.id === 'data-only') as InstalledTheme, hooks)
    expect(built.manifest.code).toBe(false)
    expect(built.manifest.files.map(file => file.path)).toEqual(['README.md', 'theme.json'])
    expect(unpackOwnTheme(built.tgz).code).toBe(false)
  })
})

describe('what does not pack', () => {
  const scratch: string[] = []
  afterEach(() => {
    for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  /** Copies a fixture theme into a scratch root under its own id and loads it. */
  function copyOf(source = 'data-only', change: (dir: string) => void = () => {}): InstalledTheme {
    const root = mkdtempSync(join(tmpdir(), 'micelio-pack-'))
    scratch.push(root)
    cpSync(join(FIXTURES, source), join(root, source), { recursive: true })
    change(join(root, source))
    const found = discoverThemes([root])[0]
    if (!found) throw new Error('no theme')
    return found
  }

  function editManifest(dir: string, edit: (manifest: Record<string, unknown>) => void): void {
    const file = join(dir, 'theme.json')
    const manifest = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
    edit(manifest)
    writeFileSync(file, JSON.stringify(manifest))
  }

  function problemsOf(theme: InstalledTheme): string {
    try {
      buildPackage(theme, hooks)
    } catch (error) {
      expect(error).toBeInstanceOf(PackError)
      return (error as PackError).problems.join('\n')
    }
    throw new Error('expected a PackError')
  }

  it('packs the copy when nothing is changed', () => {
    expect(buildPackage(copyOf(), hooks).manifest.id).toBe('data-only')
  })

  it('needs a version', () => {
    expect(problemsOf(copyOf('data-only', dir => editManifest(dir, manifest => delete manifest.version)))).toMatch(/"version" is required to pack/)
  })

  it('needs a license', () => {
    expect(problemsOf(copyOf('data-only', dir => editManifest(dir, manifest => delete manifest.license)))).toMatch(/"license" is required to pack/)
  })

  it('does not pack a theme that fails theme:check', () => {
    const theme = copyOf('low-contrast', dir => editManifest(dir, (manifest) => {
      manifest.version = '1.0.0'
      manifest.license = 'MIT-0'
    }))
    expect(problemsOf(theme)).toMatch(/needs 4\.5:1/)
  })

  it('does not pack a theme with an invalid theme.json', () => {
    expect(problemsOf(copyOf('data-only', dir => editManifest(dir, manifest => delete manifest.modes)))).toMatch(/modes/)
  })

  it('names a file outside the allowlist', () => {
    expect(problemsOf(copyOf('data-only', dir => writeFileSync(join(dir, 'notes.txt'), 'x')))).toMatch(/notes\.txt: is not a file a theme package may hold/)
  })

  it('names a folder outside the allowlist without listing what is in it', () => {
    const problems = problemsOf(copyOf('data-only', (dir) => {
      mkdirSync(join(dir, 'node_modules/x'), { recursive: true })
      writeFileSync(join(dir, 'node_modules/x/index.js'), 'x')
    }))
    expect(problems).toMatch(/node_modules: is not a folder/)
    expect(problems).not.toMatch(/index\.js/)
  })

  it('refuses a symlink, to a file or outside the theme', () => {
    const problems = problemsOf(copyOf('data-only', (dir) => {
      symlinkSync('/etc/hostname', join(dir, 'LICENSE'))
      mkdirSync(join(dir, 'images'))
      symlinkSync('../README.md', join(dir, 'images/a.png'))
    }))
    expect(problems).toMatch(/LICENSE: is a symlink/)
    expect(problems).toMatch(/images\/a\.png: is a symlink/)
  })

  it('refuses a hidden file and a bad name', () => {
    const problems = problemsOf(copyOf('data-only', (dir) => {
      writeFileSync(join(dir, '.DS_Store'), 'x')
      mkdirSync(join(dir, 'images'))
      writeFileSync(join(dir, 'images/con.png'), PNG)
      writeFileSync(join(dir, 'images/café.png'), PNG)
    }))
    expect(problems).toMatch(/\.DS_Store: .*hidden/)
    expect(problems).toMatch(/images\/con\.png: .*Windows device/)
    expect(problems).toMatch(/caf.*\.png: .*outside \[A-Za-z0-9\._-\]/)
  })

  it('refuses a file over 1 MiB', () => {
    const problems = problemsOf(copyOf('data-only', (dir) => {
      mkdirSync(join(dir, 'images'))
      writeFileSync(join(dir, 'images/big.svg'), noise(1024 * 1024 + 1))
    }))
    expect(problems).toMatch(/file-size: images\/big\.svg/)
  })

  it('refuses a path that is too deep', () => {
    const problems = problemsOf(copyOf('data-only', (dir) => {
      mkdirSync(join(dir, 'images/a/b/c/d/e/f/g'), { recursive: true })
      writeFileSync(join(dir, 'images/a/b/c/d/e/f/g/h.png'), PNG)
    }))
    expect(problems).toMatch(/depth: images\/a\/b\/c\/d\/e\/f\/g\/h\.png/)
  })

  it('takes 200 files and refuses 201', () => {
    const fill = (count: number) => (dir: string): void => {
      mkdirSync(join(dir, 'images'))
      for (let i = 0; i < count; i++) writeFileSync(join(dir, `images/i${i}.png`), PNG)
    }
    expect(buildPackage(copyOf('data-only', fill(198)), hooks).manifest.files).toHaveLength(200)
    expect(problemsOf(copyOf('data-only', fill(199)))).toMatch(/entries: the package has 201 files/)
  })

  it('refuses an image with the wrong magic bytes and an svg with a script', () => {
    expect(problemsOf(copyOf('data-only', (dir) => {
      mkdirSync(join(dir, 'images'))
      writeFileSync(join(dir, 'images/a.png'), 'not a png')
    }))).toMatch(/magic: images\/a\.png/)
    expect(problemsOf(copyOf('data-only', (dir) => {
      mkdirSync(join(dir, 'images'))
      writeFileSync(join(dir, 'images/a.svg'), '<svg><script>x</script></svg>')
    }))).toMatch(/svg: images\/a\.svg/)
  })

  it('does not keep the mode of a file on disk', () => {
    const theme = copyOf('data-only', dir => chmodSync(join(dir, 'README.md'), 0o755))
    expect(unpackOwnTheme(buildPackage(theme, hooks).tgz).files.has('README.md')).toBe(true)
  })

  it('reports a code theme from a slot even when theme.json says nothing of it', () => {
    const theme = copyOf('data-only', (dir) => {
      mkdirSync(join(dir, 'slots'))
      writeFileSync(join(dir, 'slots/ThemeMark.vue'), '<template><span /></template>')
    })
    expect(buildPackage(theme, hooks).manifest.code).toBe(true)
  })
})

describe('writing the package', () => {
  const out: string[] = []
  afterEach(() => {
    for (const dir of out.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  it('writes <id>-<version>.tgz and its manifest into a folder it creates', () => {
    const root = mkdtempSync(join(tmpdir(), 'micelio-out-'))
    const dir = join(root, '.micelio/packages')
    out.push(root)
    const built = buildPackage(installed('starter'), hooks)
    const written = writePackage(built, root)
    expect(relative(dir, written.tgz)).toBe('starter-0.1.0.tgz')
    expect(relative(dir, written.manifest)).toBe('starter-0.1.0.manifest.json')
    expect(readFileSync(written.tgz).equals(built.tgz)).toBe(true)
    expect(JSON.parse(readFileSync(written.manifest, 'utf8'))).toEqual(built.manifest)
    expect(existsSync(dir)).toBe(true)
    expect(unpackTheme(readFileSync(written.tgz), { digest: built.digest, manifest: readFileSync(written.manifest) }).digest).toBe(built.digest)
  })
})
