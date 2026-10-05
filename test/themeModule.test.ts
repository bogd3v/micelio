import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { discoverThemes, selectTheme, themeRoots } from '../modules/theme/themes'
import { themeMismatch } from '../app/helpers/runtimeConfig'

function theme(root: string, folder: string, manifest: object = { id: folder }): void {
  mkdirSync(join(root, folder), { recursive: true })
  writeFileSync(join(root, folder, 'theme.json'), JSON.stringify(manifest))
}

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'bd-themes-'))
}

describe('theme validation at discovery', () => {
  it('rejects an id that is not lowercase letters, digits and dashes', () => {
    const root = tmp()
    theme(root, 'Bad_Id')
    expect(() => discoverThemes([root])).toThrow(/"id" must match/)
  })

  it('rejects an id different from the folder name', () => {
    const root = tmp()
    theme(root, 'folder', { id: 'other' })
    expect(() => discoverThemes([root])).toThrow(/"other".*"folder"/)
  })

  it('rejects the same id in two roots, naming both paths', () => {
    const a = tmp()
    const b = tmp()
    theme(a, 'twin')
    theme(b, 'twin')
    expect(() => discoverThemes([a, b])).toThrow(`twice: ${join(a, 'twin')} and ${join(b, 'twin')}`)
  })

  it('names the file when theme.json is not valid JSON', () => {
    const root = tmp()
    mkdirSync(join(root, 'broken'))
    writeFileSync(join(root, 'broken', 'theme.json'), '{ nope')
    expect(() => discoverThemes([root])).toThrow(`Cannot read ${join(root, 'broken', 'theme.json')}`)
  })

  it('rejects font files that are not plain .woff2 names', () => {
    const root = tmp()
    theme(root, 'fonty', { id: 'fonty', fonts: [{ family: 'X', file: '../x.woff2' }] })
    expect(() => discoverThemes([root])).toThrow('font file "../x.woff2"')
    const other = tmp()
    theme(other, 'fonty2', { id: 'fonty2', fonts: [{ family: 'X', file: 'x.woff' }] })
    expect(() => discoverThemes([other])).toThrow(/must match/)
  })
})

describe('theme discovery', () => {
  it('finds the themes of the repository and of MICELIO_THEME_DIRS', () => {
    const extra = mkdtempSync(join(tmpdir(), 'bd-themes-'))
    theme(extra, 'minimal')
    const ids = discoverThemes(themeRoots(process.cwd(), extra)).map(found => found.id)
    expect(ids).toEqual(['bogota', 'minimal'])
  })

  it('accepts a directory that is itself a theme, and skips missing ones', () => {
    const extra = mkdtempSync(join(tmpdir(), 'bd-themes-'))
    theme(extra, 'inner')
    expect(discoverThemes([join(extra, 'inner'), join(extra, 'missing')]).map(found => found.id)).toEqual(['inner'])
  })

  it('selects an installed theme', () => {
    expect(selectTheme(discoverThemes(themeRoots(process.cwd(), '')), 'bogota').id).toBe('bogota')
  })

  it('fails naming the missing theme and the installed ones', () => {
    const installed = discoverThemes(themeRoots(process.cwd(), ''))
    expect(() => selectTheme(installed, 'nope')).toThrow(/"nope".*not installed.*bogota/)
  })
})

describe('themeMismatch', () => {
  it('is null when the runtime theme is the one of the build', () => {
    expect(themeMismatch({ public: { theme: 'bogota' } }, 'bogota')).toBeNull()
  })

  it('names both themes when they differ or the runtime has none', () => {
    expect(themeMismatch({ public: { theme: 'other' } }, 'bogota')).toMatch(/"other".*"bogota"/)
    expect(themeMismatch({}, 'bogota')).toMatch(/"undefined"/)
  })
})
