import { afterEach, describe, expect, it } from 'vitest'
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { compileKey, compiledDigest, compileTheme } from '../modules/theme/install/compile'
import { discoverThemes } from '../modules/theme/themes'

const ROOT = resolve(__dirname, '..')
const PACKAGE = `sha256:${'a'.repeat(64)}`
const temporary: string[] = []

/** A copy of the starter without `slots/`: a data-only theme, with a folder to edit. */
function dataOnly(): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'micelio-compile-')), 'starter')
  temporary.push(dir)
  cpSync(join(ROOT, 'themes/starter'), dir, { recursive: true })
  rmSync(join(dir, 'slots'), { recursive: true })
  return dir
}

afterEach(() => {
  for (const dir of temporary.splice(0)) rmSync(join(dir, '..'), { recursive: true, force: true })
})

describe('compileTheme', () => {
  function compiling(css: string): Promise<Awaited<ReturnType<typeof compileTheme>>> {
    const dir = dataOnly()
    writeFileSync(join(dir, 'theme.css'), css)
    const theme = discoverThemes([dir])[0]!
    return compileTheme({ theme, packageDigest: PACKAGE, code: false, coreBuild: 'test-build' })
  }

  it('rewrites the theme urls on the parsed tree, in image-set() too, and keeps fragments', async () => {
    const compiled = await compiling('.a{background:url(/theme/images/favicon.svg)}.b{background-image:image-set("/theme/images/favicon.svg" 1x)}.c{fill:url(#mask)}.d{content:"url(/fonts/x)"}')
    const css = compiled.files.get('theme.css')!.toString()
    expect(css).toContain(`/_t/${compiled.digest}/images/favicon.svg`)
    expect(css).toContain('url(#mask)')
    expect(css).toContain('url(/fonts/x)')
    expect(css).not.toMatch(/url\("?\/theme\/images/)
  })

  it('fails on a url it cannot rewrite, even if the validator did not run', async () => {
    await expect(compiling('.a{background:url(/api/secret)}')).rejects.toMatchObject({ rule: 'url' })
    await expect(compiling('.a{background:url(https://example.com/a.png)}')).rejects.toMatchObject({ rule: 'url' })
  })

  it('inlines a local @import and refuses one that leaves the folder', async () => {
    const dir = dataOnly()
    writeFileSync(join(dir, 'more.css'), '.more{color:red}')
    writeFileSync(join(dir, 'theme.css'), '@import "./more.css";')
    const theme = discoverThemes([dir])[0]!
    const compiled = await compileTheme({ theme, packageDigest: PACKAGE, code: false, coreBuild: 'test-build' })
    expect(compiled.files.get('theme.css')!.toString()).toContain('.more')
    await expect(compiling('@import "../outside.css";')).rejects.toMatchObject({ rule: 'css' })
  })

  it('compresses text files with a fixed gzip header and skips fonts', async () => {
    const compiled = await compiling('.a{color:red}')
    expect(compiled.files.get('theme.css.gz')!.subarray(0, 10).toString('hex')).toBe('1f8b0800000000000003')
    expect([...compiled.files.keys()].filter(path => path.endsWith('.woff2.gz'))).toEqual([])
  })
  it('compiles the same bytes twice, and other bytes for another core build', async () => {
    const theme = discoverThemes([dataOnly()])[0]!
    const compile = (coreBuild: string): ReturnType<typeof compileTheme> => compileTheme({ theme, packageDigest: PACKAGE, code: false, coreBuild })
    const [a, b, c] = [await compile('one'), await compile('one'), await compile('two')]
    expect([...a.files].map(([path, data]) => [path, data.toString('base64')])).toEqual([...b.files].map(([path, data]) => [path, data.toString('base64')]))
    expect(c.digest).not.toBe(a.digest)
    expect(a.digest).toBe(compiledDigest(PACKAGE, compileKey('one')))
    expect(compiledDigest(`sha256:${'b'.repeat(64)}`, compileKey('one'))).not.toBe(a.digest)
  })

  it('puts the tokens in settings, the mode switch in components and the theme in its own layer, and adds slot CSS only for a code theme', async () => {
    const dir = join(ROOT, 'themes/starter')
    const theme = discoverThemes([dir])[0]!
    const css = async (code: boolean): Promise<string> => (await compileTheme({ theme, packageDigest: PACKAGE, code, coreBuild: 'x' })).files.get('theme.css')!.toString()
    const slot = readFileSync(join(dir, 'slots/mark.css'), 'utf8').match(/\.[a-z-]+/)![0]
    expect(await css(true)).toContain(slot)
    expect(await css(false)).not.toContain(slot)
    const plain = await css(false)
    expect(plain.indexOf('@layer myc.settings')).toBeLessThan(plain.indexOf('@layer myc.components'))
    expect(plain.indexOf('@layer myc.components')).toBeLessThan(plain.indexOf('@layer myc.theme'))
    expect(plain).toContain('--ink')
  })

  it('compiles in only the variant CSS the theme chose, in the layout and pages layers before the theme', async () => {
    const theme = discoverThemes([join(ROOT, 'themes/starter')])[0]!
    const variants = { header: ['bar', 'centered'], footer: ['columns', 'minimal'], home: ['showcase', 'index'], postList: ['grid', 'list'], article: ['aside', 'centered'] }
    const layoutCss = Object.fromEntries(Object.entries(variants).map(([region, names]) => [region, Object.fromEntries(names.map(name => [name, `.x-${region}-${name}{order:1}`]))]))
    const compile = (): ReturnType<typeof compileTheme> => compileTheme({ theme, packageDigest: PACKAGE, code: false, coreBuild: 'x', layoutCss })
    const css = (await compile()).files.get('theme.css')!.toString()
    // The starter uses the second variant of every region (themes/starter/theme.json)
    for (const [region, [first, second]] of Object.entries(variants)) {
      expect(css).toContain(`.x-${region}-${second}`)
      expect(css).not.toContain(`.x-${region}-${first}`)
    }
    const at = (name: string): number => css.indexOf(name)
    expect(at('@layer myc.components')).toBeLessThan(at('.x-header-centered'))
    expect(at('.x-header-centered')).toBeLessThan(at('.x-footer-minimal'))
    expect(at('.x-footer-minimal')).toBeLessThan(at('.x-home-index'))
    expect(at('.x-home-index')).toBeLessThan(at('.x-postList-list'))
    expect(at('.x-postList-list')).toBeLessThan(at('.x-article-centered'))
    const again = (await compile()).files.get('theme.css')!.toString()
    expect(again).toBe(css)
  })

  it('compiles no variant CSS when none is given', async () => {
    const theme = discoverThemes([join(ROOT, 'themes/starter')])[0]!
    const css = (await compileTheme({ theme, packageDigest: PACKAGE, code: false, coreBuild: 'x' })).files.get('theme.css')!.toString()
    expect(css).not.toContain('.x-')
  })

  it('compiles the messages to an AST and refuses a namespace it should not', async () => {
    const compiled = await compiling('.a{color:red}')
    const runtime = JSON.parse(compiled.files.get('runtime.json')!.toString()) as { messages: { en: { theme: Record<string, unknown> } } }
    expect(Object.keys(runtime.messages.en.theme).length).toBeGreaterThan(0)
    const dir = dataOnly()
    writeFileSync(join(dir, 'i18n/en.json'), '{"nav":{"home":"Home"}}')
    const theme = discoverThemes([dir])[0]!
    await expect(compileTheme({ theme, packageDigest: PACKAGE, code: false, coreBuild: 'x' })).rejects.toMatchObject({ rule: 'messages' })
  })

  it('refuses a symlink among the assets and skips a file that is not a font', async () => {
    const dir = dataOnly()
    writeFileSync(join(dir, 'fonts/notes.md'), 'x')
    const theme = discoverThemes([dir])[0]!
    const compiled = await compileTheme({ theme, packageDigest: PACKAGE, code: false, coreBuild: 'x' })
    expect(compiled.warnings).toEqual(['fonts/notes.md is not a font or a license (woff, woff2, txt) and is not served'])
    expect(compiled.files.has('fonts/notes.md')).toBe(false)
    symlinkSync('/etc/hostname', join(dir, 'fonts/link.txt'))
    await expect(compileTheme({ theme, packageDigest: PACKAGE, code: false, coreBuild: 'x' })).rejects.toMatchObject({ rule: 'assets' })
  })
})
