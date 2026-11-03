import { afterEach, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// scripts/docker/builder-entrypoint.sh with a stand-in `npm`: what the volume holds after a generation that fails, and after one that works (#315).
// The real generation, with the real Nuxt build, is `npm run test:static-theme`.
const ENTRYPOINT = resolve(__dirname, '../scripts/docker/builder-entrypoint.sh')
const folders: string[] = []

afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true })
})

/** A working folder with a volume that holds the site of the last run and an `npm` that either fails like the theme step does or writes a new site. */
function setup(): { cwd: string, out: string, run: (fail: boolean) => ReturnType<typeof spawnSync> } {
  const cwd = mkdtempSync(join(tmpdir(), 'micelio-entrypoint-'))
  folders.push(cwd)
  const bin = join(cwd, 'bin')
  const out = join(cwd, 'out')
  mkdirSync(bin)
  mkdirSync(out)
  writeFileSync(join(out, 'index.html'), 'last good site')
  writeFileSync(join(out, 'old-page.html'), 'a page removed in the CMS')
  writeFileSync(join(bin, 'npm'), '#!/bin/sh\nif [ -n "$FAKE_NPM_FAIL" ]; then echo "Static theme: the theme the site settings name (\\"nope\\") was not used (unknown)" >&2; exit 1; fi\nmkdir -p .output/public && echo "new site" > .output/public/index.html\n')
  chmodSync(join(bin, 'npm'), 0o755)
  const run = (fail: boolean): ReturnType<typeof spawnSync> => spawnSync('sh', [ENTRYPOINT, 'generate'], {
    cwd,
    encoding: 'utf8',
    env: { PATH: `${bin}:${process.env.PATH}`, OUT_DIR: out, NUXT_PUBLIC_STRAPI_URL: 'http://127.0.0.1:1', NUXT_STRAPI_API_TOKEN: 'build-token', ...(fail && { FAKE_NPM_FAIL: '1' }) },
  })
  return { cwd, out, run }
}

describe('the builder image\'s generate command', () => {
  it('leaves the volume as it was, and reports why, when the generation fails (a theme the site settings name cannot be used)', () => {
    const { out, run } = setup()
    const result = run(true)
    expect(result.status).toBe(1)
    expect(String(result.stderr)).toContain('Static theme: the theme the site settings name ("nope") was not used (unknown)')
    expect(String(result.stderr)).toContain(`micelio-builder: the generation failed; ${out} keeps the site it held before.`)
    expect(readFileSync(join(out, 'index.html'), 'utf8')).toBe('last good site')
    expect(readFileSync(join(out, 'old-page.html'), 'utf8')).toBe('a page removed in the CMS')
    expect(String(result.stdout)).not.toContain('site written')
  })

  it('replaces the whole volume when the generation works, so a page removed in the CMS does not linger', () => {
    const { out, run } = setup()
    const result = run(false)
    expect(result.status).toBe(0)
    expect(readFileSync(join(out, 'index.html'), 'utf8')).toBe('new site\n')
    expect(existsSync(join(out, 'old-page.html'))).toBe(false)
    expect(String(result.stdout)).toContain(`micelio-builder: site written to ${out}`)
  })
})
