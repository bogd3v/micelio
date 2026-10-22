import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { loadBuiltInTheme, loadDefaultTheme } from '../server/lib/builtInStore'
import { loadHooks } from '../modules/theme/hooks'
import { installTheme } from '../modules/theme/install/install'
import type { BuiltInIndex } from '../modules/theme/install/types'

const ROOT = resolve(__dirname, '..')
const HOOKS = loadHooks(join(ROOT, 'app'))
const FOLDERS: Record<string, string> = {
  'minimal': 'test/fixtures/themes/minimal',
  'data-only': 'test/fixtures/themes/data-only',
  'starter': 'themes/starter',
}

let store: string

/** Writes the index of a store that holds every fixture, as the build would, with `buildTheme` as the one the image was made for. */
function useBuild(buildTheme: string, indexed: BuiltInIndex['themes']): void {
  const index: BuiltInIndex = { coreBuild: 'default', buildTheme, themes: indexed }
  writeFileSync(join(store, 'index.json'), JSON.stringify(index))
}

describe('loadDefaultTheme', () => {
  let themes: BuiltInIndex['themes']

  beforeAll(async () => {
    store = mkdtempSync(join(tmpdir(), 'micelio-default-theme-'))
    themes = {}
    for (const [id, folder] of Object.entries(FOLDERS)) {
      const result = await installTheme({ kind: 'folder', dir: join(ROOT, folder) }, { storeDir: store, hooks: HOOKS, coreBuild: 'default', allowCode: true })
      themes[id] = { digest: result.digest, version: result.manifest.version, code: result.manifest.code }
    }
  })

  afterAll(() => {
    rmSync(store, { recursive: true, force: true })
  })

  it('uses the build\'s theme when nothing is configured', () => {
    useBuild('minimal', themes)
    for (const configured of [undefined, '', '   ', 42, 'minimal', ' minimal ']) {
      expect(loadDefaultTheme(store, configured).runtime.id, String(configured)).toBe('minimal')
    }
  })

  it('serves another data-only theme from the same store, without a rebuild', () => {
    useBuild('minimal', themes)
    const chosen = loadDefaultTheme(store, 'data-only')
    expect(chosen.runtime.id).toBe('data-only')
    expect(chosen.runtime.digest).toBe(themes['data-only']!.digest)
    expect(chosen.runtime.digest).not.toBe(loadBuiltInTheme(store, 'minimal').runtime.digest)
  })

  it('stops the boot naming NUXT_PUBLIC_THEME and the themes the store holds when the theme is not installed', () => {
    useBuild('minimal', themes)
    expect(() => loadDefaultTheme(store, 'nope')).toThrow(/NUXT_PUBLIC_THEME is "nope".*minimal/)
    expect(() => loadDefaultTheme(store, '__proto__')).toThrow(/NUXT_PUBLIC_THEME is "__proto__"/)
  })

  it('refuses a theme with code when the build was made for another one', () => {
    useBuild('minimal', themes)
    expect(() => loadDefaultTheme(store, 'starter')).toThrow(/"starter".*made for "minimal".*Rebuild/)
  })

  it('refuses any other theme on a build whose own theme ships code', () => {
    useBuild('starter', themes)
    expect(() => loadDefaultTheme(store, 'minimal')).toThrow(/"minimal".*made for "starter"/)
    expect(loadDefaultTheme(store, 'starter').runtime.id).toBe('starter')
  })
})
