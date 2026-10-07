import { describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FONT_TOTAL_MAX_BYTES, checkTheme } from '../modules/theme/check'
import { CONTRAST_RULES, contrastProblems } from '../modules/theme/contrast'
import { loadHooks } from '../modules/theme/hooks'
import { discoverThemes, themeRoots } from '../modules/theme/themes'

const root = fileURLToPath(new URL('..', import.meta.url))
const fixtures = fileURLToPath(new URL('./fixtures/themes', import.meta.url))
const hooks = loadHooks(fileURLToPath(new URL('../app', import.meta.url)))
const installed = discoverThemes(themeRoots(root, ''))
const cases = installed.flatMap(theme => theme.manifest.modes.map(mode => ({ id: theme.id, mode: mode.id })))

describe('contrast matrix of the installed themes', () => {
  it('installs at least Bogotá', () => {
    expect(installed.map(theme => theme.id)).toContain('bogota')
  })

  describe.each(cases)('$id in $mode', ({ id, mode }) => {
    const theme = installed.find(candidate => candidate.id === id)!
    const failures = contrastProblems(theme.manifest).filter(problem => problem.mode === mode)

    it('meets every contrast rule and the ratios its tokens declare', () => {
      expect(failures.map(problem => problem.message)).toEqual([])
    })
  })
})

describe('rule table', () => {
  const rule = (role: string): { surfaces: string[], min: number } => CONTRAST_RULES.find(candidate => candidate.role === role)!

  it('holds text to 4.5 and controls to 3', () => {
    expect(rule('ink-muted').min).toBe(4.5)
    expect(rule('on-accent').surfaces).toEqual(['accent', 'accent-hover'])
    expect(rule('code-keyword').surfaces).toEqual(['surface-sunken'])
    expect(rule('link').surfaces).toContain('link-soft')
    expect(rule('line-strong').min).toBe(3)
    expect(rule('focus').min).toBe(3)
    expect(CONTRAST_RULES.filter(candidate => candidate.min === 3).map(candidate => candidate.role).sort()).toEqual(['focus', 'line-strong'])
  })
})

describe('optional roles', () => {
  it('are checked with the core default when the theme omits them', () => {
    const [minimal] = discoverThemes([`${fixtures}/minimal`])
    const manifest = structuredClone(minimal!.manifest)
    manifest.color.tokens = manifest.color.tokens.filter(token => token.name !== 'link-soft')
    manifest.color.tokens.find(token => token.name === 'link')!.value = '#9aa0a6'
    expect(contrastProblems(manifest).some(problem => problem.role === 'link' && problem.surface === 'link-soft')).toBe(true)
  })
})

describe('a theme that fails contrast', () => {
  const [lowContrast] = discoverThemes([`${fixtures}/low-contrast`])
  const theme = lowContrast!

  it('names the theme, mode, role, surface, ratio, minimum and the nearest passing value', () => {
    const messages = contrastProblems(theme.manifest).map(problem => problem.message)
    expect(messages).toContain('theme "low-contrast", mode "day": "ink-muted" on "surface" has 1.90:1, needs 4.5:1; nearest passing value #766759')
    expect(messages).toContain('theme "low-contrast", mode "day": "line-strong" on "surface-sunken" has 3.28:1, needs 4:1; nearest passing value #806150')
  })

  it('reports the problems as data', () => {
    const problem = contrastProblems(theme.manifest).find(candidate => candidate.surface === 'surface')!
    expect(problem).toMatchObject({ theme: 'low-contrast', mode: 'day', role: 'ink-muted', surface: 'surface', ratio: 1.9, min: 4.5, suggestion: '#766759' })
  })

  it('is an error in the report, with the same fields in --json', () => {
    const report = checkTheme(theme, hooks)
    expect(report.theme).toBe('low-contrast')
    expect(report.errors).toHaveLength(4)
    expect(report.errors[0]).toMatchObject({ kind: 'contrast', mode: 'day', role: 'ink-muted', surface: 'surface', ratio: 1.9, min: 4.5, suggestion: '#766759' })
    expect(Object.keys(report.errors[0]!).sort()).toEqual(['kind', 'message', 'min', 'mode', 'ratio', 'role', 'suggestion', 'surface'])
  })

  it('reports an unknown "on" instead of passing', () => {
    const manifest = structuredClone(theme.manifest)
    manifest.color.tokens.find(token => token.name === 'ink')!.contrast = [{ on: 'nowhere', min: 3 }]
    expect(contrastProblems(manifest).map(problem => problem.message)).toContain('theme "low-contrast", mode "day": cannot check "ink" on "nowhere": "nowhere" has no value')
  })
})

describe('checkTheme', () => {
  it('passes the minimal fixture and warns about nothing', () => {
    const [minimal] = discoverThemes([`${fixtures}/minimal`])
    expect(checkTheme(minimal!, hooks)).toEqual({ theme: 'minimal', errors: [], warnings: [] })
  })

  it('has no font warning for Bogotá (fonts under the 100 KB target, #350)', () => {
    const bogota = installed.find(theme => theme.id === 'bogota')!
    const report = checkTheme(bogota, hooks)
    expect(report.errors).toEqual([])
    expect(report.warnings).toEqual([])
  })

  it('warns, without failing, about fonts over 100 KB', () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'theme-')), 'minimal')
    cpSync(`${fixtures}/minimal`, dir, { recursive: true })
    mkdirSync(join(dir, 'fonts'))
    writeFileSync(join(dir, 'fonts', 'big.woff2'), Buffer.alloc(120 * 1024))
    const [minimal] = discoverThemes([`${fixtures}/minimal`])
    const heavy = { ...minimal!, dir, manifest: { ...minimal!.manifest, fonts: [{ family: 'Big', file: 'big.woff2' }] } }
    const report = checkTheme(heavy, hooks)
    expect(report.errors).toEqual([])
    expect(report.warnings.map(warning => warning.message)).toEqual([expect.stringContaining('fonts total 120.0 KB')])
  })

  it('errors when the fonts pass the ceiling', () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'theme-')), 'minimal')
    cpSync(`${fixtures}/minimal`, dir, { recursive: true })
    mkdirSync(join(dir, 'fonts'))
    writeFileSync(join(dir, 'fonts', 'big.woff2'), Buffer.alloc(FONT_TOTAL_MAX_BYTES + 1))
    const [minimal] = discoverThemes([`${fixtures}/minimal`])
    const heavy = { ...minimal!, dir, manifest: { ...minimal!.manifest, fonts: [{ family: 'Big', file: 'big.woff2' }] } }
    expect(checkTheme(heavy, hooks).errors.map(error => error.message)).toEqual([expect.stringContaining('fonts total')])
  })

  it('stops at the contract when theme.json is invalid', () => {
    const [minimal] = discoverThemes([`${fixtures}/minimal`])
    const broken = { ...minimal!, manifest: { ...minimal!.manifest, contract: 2 } }
    const report = checkTheme(broken, hooks)
    expect(report.errors.every(issue => issue.kind === 'contract')).toBe(true)
    expect(report.errors).not.toHaveLength(0)
  })
})
