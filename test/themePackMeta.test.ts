import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { contractProblems, themeIdProblem, themeJsonSchema } from '../modules/theme/contract'
import { packProblems } from '../modules/theme/registry/pack'

const FIXTURES = join(process.cwd(), 'test/fixtures/themes')

function minimal(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(FIXTURES, 'minimal/theme.json'), 'utf8'))
}

function problemsWith(extra: Record<string, unknown>): string {
  return contractProblems({ ...minimal(), ...extra }).join('\n')
}

describe('theme id grammar (ADR 0009, section 2)', () => {
  it.each(['bogota', 'starter', 'a', 'my-theme', 'theme2', '2-col', 'a'.repeat(64)])('accepts "%s"', (id) => {
    expect(themeIdProblem(id)).toBeNull()
    expect(contractProblems({ ...minimal(), id })).toEqual([])
  })

  it.each(['--x', 'x--y', 'x-', '-x', '-', '', 'Upper', 'a_b', 'a.b', 'a'.repeat(65)])('rejects "%s"', (id) => {
    expect(themeIdProblem(id)).toMatch(/"id" must match/)
    expect(problemsWith({ id })).toMatch(/"id" must match/)
  })
})

describe('version', () => {
  it('is optional', () => {
    expect(contractProblems(minimal())).toEqual([])
  })

  it.each(['0.0.0', '1.2.3', '10.20.30', '1.0.0-alpha', '1.0.0-alpha.1', '1.0.0-0.3.7', '1.0.0-x-y.z'])('accepts "%s"', (version) => {
    expect(problemsWith({ version })).toBe('')
  })

  it.each(['1', '1.2', '01.2.3', '1.02.3', '1.2.3.4', 'v1.2.3', '1.2.3+build.5', '1.2.3-', '1.2.3-01', '1.2.3-a..b', ' 1.2.3', '', '1.2.3\n'])('rejects %j', (version) => {
    expect(problemsWith({ version })).toMatch(/^version: /)
  })

  it('rejects a non-string', () => {
    expect(problemsWith({ version: 1 })).toMatch(/^version: /)
  })

  it('accepts 128 characters and rejects 129', () => {
    const base = '1.0.0-'
    expect(problemsWith({ version: base + 'a'.repeat(128 - base.length) })).toBe('')
    expect(problemsWith({ version: base + 'a'.repeat(129 - base.length) })).toMatch(/at most 128/)
  })
})

describe('license', () => {
  it('is optional', () => {
    expect(problemsWith({})).toBe('')
  })

  it.each(['MIT', 'MIT-0', 'AGPL-3.0-only', 'Apache-2.0', 'CC-BY-SA-4.0', 'OFL-1.1', 'LicenseRef-Acme-1.0', 'LicenseRef-proprietary', 'LicenseRef-A.b-C'])('accepts "%s"', (license) => {
    expect(problemsWith({ license })).toBe('')
  })

  it.each(['mit', 'MIT OR Apache-2.0', 'Proprietary', 'LicenseRef-', 'LicenseRef-a b', 'LicenseRef-a_b', 'LicenseRef-é', 'GPL-9.9', '', 'MIT\n'])('rejects %j with a clear message', (license) => {
    expect(problemsWith({ license })).toMatch(/^license: .*(SPDX|LicenseRef)/)
  })

  it('rejects a non-string', () => {
    expect(problemsWith({ license: true })).toMatch(/^license: /)
  })
})

describe('the schema', () => {
  it('describes version and license as optional', () => {
    const schema = themeJsonSchema() as { properties: Record<string, unknown>, required: string[] }
    expect(Object.keys(schema.properties)).toEqual(expect.arrayContaining(['version', 'license']))
    expect(schema.required).not.toContain('version')
    expect(schema.required).not.toContain('license')
  })
})

describe('packProblems', () => {
  it('is empty when version and license are set', () => {
    expect(packProblems({ version: '1.0.0', license: 'MIT' })).toEqual([])
  })

  it('names a missing version and a missing license', () => {
    expect(packProblems({})).toEqual([
      '"version" is required to pack a theme (semver, for example "1.0.0")',
      '"license" is required to pack a theme (an SPDX id or LicenseRef-*)',
    ])
  })

  it('treats an empty value as missing', () => {
    expect(packProblems({ version: '', license: '' })).toHaveLength(2)
  })

  it('names only the missing field', () => {
    expect(packProblems({ version: '1.0.0' })).toEqual(['"license" is required to pack a theme (an SPDX id or LicenseRef-*)'])
  })
})

describe('the installed themes', () => {
  it.each([
    ['starter', 'MIT-0'],
  ])('%s declares a version and the license %s, and can be packed', (id, license) => {
    const manifest = JSON.parse(readFileSync(join(process.cwd(), 'themes', id, 'theme.json'), 'utf8')) as { version?: string, license?: string }
    expect(manifest.license).toBe(license)
    expect(packProblems(manifest)).toEqual([])
    expect(contractProblems(manifest)).toEqual([])
  })
})
