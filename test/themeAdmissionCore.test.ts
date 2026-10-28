import { afterEach, describe, expect, it, vi } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { displayFamilyOf, installedManifest } from '../scripts/perf/theme-manifest.mjs'
import { ADMISSION_ENV, discoverThemes, themeRoots } from '../modules/theme/themes'

const ROOT = process.cwd()
const dirs: string[] = []

function temp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'micelio-admission-'))
  dirs.push(dir)
  return dir
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function install(root: string, where: string, id: string, name: string, display = ''): string {
  const dir = join(root, where, id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'theme.json'), JSON.stringify({ id, name, type: { families: { display } } }))
  return dir
}

describe('admitting a theme repository against a core that ships the same id', () => {
  it('uses the repository copy, and says so once', () => {
    const root = temp()
    install(root, 'themes', 'same', 'core')
    install(root, 'themes', 'other', 'core')
    const given = install(root, 'theme-source/themes', 'same', 'repository')
    vi.stubEnv(ADMISSION_ENV, 'true')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const roots = themeRoots(root, join(root, 'theme-source/themes'))
    const found = discoverThemes(roots)
    discoverThemes(roots)
    expect(found.map(item => [item.id, item.manifest.name]).sort()).toEqual([['other', 'core'], ['same', 'repository']])
    expect(found.find(item => item.id === 'same')?.dir).toBe(given)
    expect(warn.mock.calls.filter(([message]) => String(message).startsWith('using same from '))).toEqual([[`using same from ${given}, not the core's`]])
  })

  it('is an error without the admission switch, as the core build and nuxt dev have it', () => {
    const root = temp()
    install(root, 'themes', 'same', 'core')
    install(root, 'theme-source/themes', 'same', 'repository')
    expect(() => discoverThemes(themeRoots(root, join(root, 'theme-source/themes')))).toThrow(/installed twice/)
  })

  it('still refuses two given folders with the same id', () => {
    const root = temp()
    install(root, 'themes', 'same', 'core')
    install(root, 'first', 'same', 'one')
    install(root, 'second', 'same', 'two')
    vi.stubEnv(ADMISSION_ENV, 'true')
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(() => discoverThemes(themeRoots(root, `${join(root, 'first')}:${join(root, 'second')}`))).toThrow(/installed twice/)
  })

  it('measures the copy discovery chose: the performance run reads the repository manifest, not the core\'s', async () => {
    const root = temp()
    install(root, 'themes', 'same', 'core', '"Core Face", serif')
    install(root, 'theme-source/themes', 'same', 'repository', '"Repository Face", serif')
    vi.stubEnv('MICELIO_THEME_DIRS', join(root, 'theme-source/themes'))
    vi.stubEnv(ADMISSION_ENV, 'true')
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const manifest = await installedManifest(root, 'same')
    expect(manifest?.name).toBe('repository')
    expect(displayFamilyOf(manifest)).toBe('repository face')
    expect(await installedManifest(root, 'missing')).toBeUndefined()
    expect(displayFamilyOf(undefined)).toBeUndefined()
  })

  describe('theme:admit plan', () => {
    function plan(env: Record<string, string>, ...args: string[]): ReturnType<typeof spawnSync> {
      return spawnSync(join(ROOT, 'node_modules/.bin/jiti'), [join(ROOT, 'scripts/theme-admit.ts'), 'plan', ...args], { encoding: 'utf8', cwd: ROOT, env: { ...process.env, ...env } })
    }

    it('admits a repository theme named like the core\'s starter', () => {
      const root = temp()
      const given = install(root, 'repo/themes', 'starter', 'repository')
      const result = plan({ MICELIO_THEME_DIRS: join(root, 'repo/themes'), [ADMISSION_ENV]: 'true' }, '--modes', '["dynamic"]')
      expect(result.stderr).toContain(`using starter from ${given}, not the core's`)
      expect(result.status).toBe(0)
      expect(JSON.parse(String(result.stdout)).themes.map((item: { id: string }) => item.id)).toEqual(['starter'])
    })

    it('fails as before when the switch is off', () => {
      const root = temp()
      install(root, 'repo/themes', 'starter', 'repository')
      const result = plan({ MICELIO_THEME_DIRS: join(root, 'repo/themes'), [ADMISSION_ENV]: '' }, '--modes', '["dynamic"]')
      expect(result.stderr).toContain('Theme "starter" is installed twice')
      expect(result.status).toBe(1)
    })
  })
})
