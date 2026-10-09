import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadHooks } from '../modules/theme/hooks'
import { checkTheme } from '../modules/theme/check'
import { discoverThemes } from '../modules/theme/themes'
import { parseThemeNewArgs, scaffoldTheme } from '../modules/theme/scaffold'

const STARTER = join(__dirname, '..', 'themes', 'starter')
let tmp: string

function files(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => statSync(join(dir, entry)).isDirectory() ? files(join(dir, entry)) : [join(dir, entry)])
}

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'theme-new-'))
})
afterEach(() => rmSync(tmp, { recursive: true, force: true }))

describe('scaffoldTheme', () => {
  it('sets id and name and leaves no starter text behind', () => {
    const target = join(tmp, 'my-theme')
    scaffoldTheme(STARTER, target, 'my-theme', ['bogota', 'starter'], 'My Theme')
    const manifest = JSON.parse(readFileSync(join(target, 'theme.json'), 'utf8')) as Record<string, unknown>
    expect(manifest.id).toBe('my-theme')
    expect(manifest.name).toBe('My Theme')
    expect(manifest.$schema).toBe('../theme.schema.json')
    for (const file of files(target).filter(name => extname(name) !== '.woff2')) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/starter/i)
    }
    expect(readFileSync(join(target, 'slots', 'ThemeMark.vue'), 'utf8')).toContain('my-theme-mark')
  })

  it('produces a theme the real checker accepts', () => {
    scaffoldTheme(STARTER, join(tmp, 'checked'), 'checked', ['bogota', 'starter'], 'Checked')
    const [theme] = discoverThemes([join(tmp, 'checked')])
    const report = checkTheme(theme!, loadHooks(join(__dirname, '..', 'app')))
    expect(report.errors).toEqual([])
  })

  it('renames only what carries the starter prefix and leaves the license text alone', () => {
    scaffoldTheme(STARTER, join(tmp, 'plain2'), 'plain2', [])
    expect(readFileSync(join(tmp, 'plain2', 'fonts', 'OFL-Fraunces.txt'), 'utf8')).toBe(readFileSync(join(STARTER, 'fonts', 'OFL-Fraunces.txt'), 'utf8'))
    expect(readFileSync(join(tmp, 'plain2', 'theme.css'), 'utf8')).toMatch(/^\/\* plain2:/)
  })

  it('rejects names that would break the header comment', () => {
    expect(() => scaffoldTheme(STARTER, join(tmp, 'n1'), 'n1', [], 'a */ b')).toThrow(/Invalid theme name/)
    expect(() => scaffoldTheme(STARTER, join(tmp, 'n2'), 'n2', [], 'a\nb')).toThrow(/Invalid theme name/)
  })

  it('removes the half-created folder when the rename fails', () => {
    const broken = join(tmp, 'src')
    cpSync(STARTER, broken, { recursive: true })
    rmSync(join(broken, 'theme.json'))
    expect(() => scaffoldTheme(broken, join(tmp, 'half'), 'half', [])).toThrow()
    expect(existsSync(join(tmp, 'half'))).toBe(false)
  })

  it('uses the id as the default name', () => {
    scaffoldTheme(STARTER, join(tmp, 'plain'), 'plain', [])
    expect(JSON.parse(readFileSync(join(tmp, 'plain', 'theme.json'), 'utf8')).name).toBe('plain')
  })

  it('rejects an invalid id', () => {
    expect(() => scaffoldTheme(STARTER, join(tmp, 'x'), 'Bad_Id', [])).toThrow(/Invalid theme id/)
  })

  it.each(['myc', 'micelio', 'bd'])('rejects the reserved id "%s"', (id) => {
    expect(() => scaffoldTheme(STARTER, join(tmp, 'x'), id, [])).toThrow(/Invalid theme id.*reserved/)
  })

  it('rejects an installed id and an existing folder', () => {
    expect(() => scaffoldTheme(STARTER, join(tmp, 'bogota'), 'bogota', ['bogota'])).toThrow(/already installed/)
    expect(() => scaffoldTheme(STARTER, tmp, 'fresh', [])).toThrow(/already exists/)
  })
})

describe('parseThemeNewArgs', () => {
  it('takes one id and an optional name in both forms', () => {
    expect(parseThemeNewArgs(['demo'])).toEqual({ id: 'demo', name: undefined })
    expect(parseThemeNewArgs(['demo', '--name', 'Demo Theme'])).toEqual({ id: 'demo', name: 'Demo Theme' })
    expect(parseThemeNewArgs(['--name=Demo', 'demo'])).toEqual({ id: 'demo', name: 'Demo' })
  })

  it('rejects a missing or extra id', () => {
    expect(() => parseThemeNewArgs([])).toThrow(/exactly one theme id/)
    expect(() => parseThemeNewArgs(['a', 'b'])).toThrow(/exactly one theme id/)
  })

  it('rejects unknown flags and a name without a value', () => {
    expect(() => parseThemeNewArgs(['demo', '--nope'])).toThrow(/Usage/)
    expect(() => parseThemeNewArgs(['demo', '--name'])).toThrow(/Usage/)
  })
})
