import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { ThemeRegistry } from '../modules/theme/registry/types'
import { createThemeCatalogue } from '../server/lib/themeCatalogue'

const ROOT = resolve(__dirname, '..')

function sources(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) return sources(path)
    return /\.(ts|mjs)$/.test(entry.name) ? [path] : []
  })
}

describe('who can change the theme', () => {
  // Only the CMS admin role changes `site-setting.theme` (ADR 0009, section 3); the token of the frontend is `find` only (docs/security.md)
  it('never lets the frontend write to the CMS\'s site settings', () => {
    let calls = 0
    for (const file of sources('server')) {
      const text = readFileSync(join(ROOT, file), 'utf8')
      for (const call of text.matchAll(/strapiFetch(?:<[^>]*>)?\(([^)]*site-setting[^)]*)\)/gs)) {
        calls++
        expect(call[1], file).not.toMatch(/method\s*:/)
      }
    }
    // The read in server/utils/site.ts is the one call, so the check above looked at something
    expect(calls).toBeGreaterThan(0)
  })

  it('has no route that changes the theme: the status is a GET', () => {
    const routes = sources('server/api/theme')
    expect(routes).toEqual(['server/api/theme/catalogue.get.ts', 'server/api/theme/status.get.ts'])
    expect(routes.every(route => route.endsWith('.get.ts'))).toBe(true)
  })

  // The route needs Nitro's globals, so its source is read; the catalogue it answers is built by the background reads alone (ADR 0009, sections 3 and 6)
  it('answers the catalogue from memory: a request makes no network call', async () => {
    const route = readFileSync(join(ROOT, 'server/api/theme/catalogue.get.ts'), 'utf8')
    expect(route).toContain('return themeCatalogue()')
    expect(route).not.toMatch(/await|fetch|registry|refresh|relist/i)
    const util = readFileSync(join(ROOT, 'server/utils/activeTheme.ts'), 'utf8')
    expect(util.slice(util.indexOf('export function themeCatalogue('))).toMatch(/^[^]*?return catalogue\.current\(\)\n\}/)
    let reads = 0
    const registry = (): ThemeRegistry => {
      reads++
      return { index: () => Promise.resolve({ version: 1, themes: {} }) } as unknown as ThemeRegistry
    }
    const catalogue = createThemeCatalogue({ stored: () => Promise.resolve([]), registry, warn: () => undefined })
    await catalogue.refresh()
    expect(reads).toBe(1)
    for (let request = 0; request < 100; request++) expect(catalogue.current()).toEqual({ installed: [], registry: [], reason: null, updates: [], reports: [] })
    expect(reads).toBe(1)
  })

  // The plugin needs Nitro's globals, so this reads its source: a request waits for the local boot work and for nothing the network answers (ADR 0009, section 6)
  it('keeps the network out of the request path: a request awaits only the local boot work', () => {
    const text = readFileSync(join(ROOT, 'server/plugins/builtInTheme.ts'), 'utf8')
    const hook = text.slice(text.indexOf('hook(\'request\''))
    expect(hook).toContain('await started.ready')
    expect(hook).not.toMatch(/loadSite|settled|await ready/)
    expect(text).not.toContain('.settled(')
  })
})
