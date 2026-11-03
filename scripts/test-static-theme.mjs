// npm run test:static-theme: the builder image's `generate` command, run as the image runs it (scripts/docker/builder-entrypoint.sh), against
// the mock Strapi, for a theme the site settings name (ADR 0009, section 7, #315). One checkout, one tree, no new image:
//   1. the settings name bogota by its locked pin: the site is written to the volume, with bogota's files under /_t/<digest>/;
//   2. they name a theme that does not exist: the generation fails with the reason, and the volume keeps the site of step 1 byte for byte;
//   3. they name starter: the volume now holds a site with starter's files, and bogota's are gone.
// Needs the default theme pulled (`npm run theme:pull -- --frozen`). STATIC_THEME_MOCK_PORT and STATIC_THEME_APP_PORT change the ports.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { staticEnv, waitFor } from './lib/static-generate.mjs'

const mockPort = process.env.STATIC_THEME_MOCK_PORT ?? '4390'
const appPort = process.env.STATIC_THEME_APP_PORT ?? '3290'
const mock = `http://127.0.0.1:${mockPort}`
const out = mkdtempSync(join(tmpdir(), 'micelio-static-theme-'))
const lock = JSON.parse(readFileSync('themes.lock.json', 'utf8'))
const locked = { themeId: 'bogota', themeVersion: lock.bogota.version, themeDigest: lock.bogota.digest }

const server = spawn('node', ['e2e/mock-strapi.mjs'], {
  env: { ...process.env, MOCK_PORT: mockPort, MOCK_FRONTEND_URL: `http://127.0.0.1:${appPort}`, MOCK_THEME_SWITCH: '1' },
  stdio: 'ignore',
})

/** Tells the mock which theme the site settings name from now on. */
async function name(theme) {
  const response = await fetch(`${mock}/__mock/theme`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(theme) })
  assert.equal(response.status, 200, 'the mock Strapi takes the theme')
}

/** Runs the builder image's `generate` command over `out`; resolves with its exit code, and what it printed on stderr and on stdout. */
function generate() {
  return new Promise((resolve) => {
    const child = spawn('sh', ['scripts/docker/builder-entrypoint.sh', 'generate'], {
      env: { ...process.env, ...staticEnv({ mockPort, siteUrl: `http://127.0.0.1:${appPort}` }), OUT_DIR: out, NUXT_PUBLIC_SITE_MODE: 'static' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    let stdout = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk
      process.stdout.write(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
      process.stderr.write(chunk)
    })
    child.once('exit', code => resolve({ code, stderr, stdout }))
  })
}

/** A hash of every file of the volume and its path, to tell that a failed generation changed nothing. */
function fingerprint(dir) {
  const hash = createHash('sha256')
  const walk = (folder) => {
    for (const entry of readdirSync(folder, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const path = join(folder, entry.name)
      if (entry.isDirectory()) walk(path)
      else hash.update(`${path}\0${statSync(path).size}\0`).update(readFileSync(path))
    }
  }
  walk(dir)
  return hash.digest('hex')
}

/** The theme the volume's site names: `_micelio.json`, the stylesheet the home page links, and the files under /_t/. */
function themeOf() {
  const { theme } = JSON.parse(readFileSync(join(out, '_micelio.json'), 'utf8'))
  const linked = [...readFileSync(join(out, 'index.html'), 'utf8').matchAll(/href="\/_t\/([0-9a-f]{64})\/theme\.css"/g)].map(match => match[1])
  assert.deepEqual([...new Set(linked)], [theme.digest], 'the home page links the stylesheet of the theme _micelio.json names')
  assert.ok(existsSync(join(out, '_t', theme.digest, 'theme.css')), 'the theme\'s stylesheet is in the output')
  assert.deepEqual(readdirSync(join(out, '_t')), [theme.digest], 'only the theme of this build is published')
  const headers = readFileSync(join(out, '_headers'), 'utf8')
  assert.match(headers, /\/_t\/\*\n {2}Cache-Control: public, max-age=31536000, immutable/, '/_t/* is immutable')
  assert.match(headers, /\/_micelio\.json\n {2}Cache-Control: public, max-age=0, must-revalidate/, '/_micelio.json is revalidated')
  return theme
}

let status = 1
try {
  await waitFor(`${mock}/api/site-setting`)

  await name(locked)
  const first = await generate()
  assert.equal(first.code, 0, 'generating with the locked bogota pin succeeds')
  assert.doesNotMatch(first.stdout + first.stderr, /is live on the theme package/, 'the first build finds no site that is live')
  const bogota = themeOf()
  assert.equal(bogota.id, 'bogota')
  assert.equal(bogota.packageDigest, lock.bogota.digest)
  assert.equal(bogota.source, 'built-in')
  const kept = fingerprint(out)

  await name({ themeId: 'does-not-exist' })
  const failed = await generate()
  // The builder reads the site published last from the volume, which is what lets a yanked version install again for it (ADR 0009, section 3(a))
  assert.ok((failed.stdout + failed.stderr).includes(`is live on the theme package ${lock.bogota.digest}`), 'the build knows which theme the volume\'s site is live on')
  assert.notEqual(failed.code, 0, 'a theme that does not exist fails the generation')
  assert.match(failed.stderr, /Static theme: the theme the site settings name \("does-not-exist"\) was not used \(unknown\)/, 'the reason is reported')
  assert.match(failed.stderr, /micelio-builder: the generation failed; .* keeps the site it held before/, 'the volume is said to keep the last site')
  assert.equal(fingerprint(out), kept, 'the volume still holds the first site, byte for byte')

  await name({ themeId: 'starter' })
  const second = await generate()
  assert.equal(second.code, 0, 'generating with the starter succeeds')
  const starter = themeOf()
  assert.equal(starter.id, 'starter')
  assert.notEqual(starter.digest, bogota.digest, 'the new site names the new theme\'s files')
  assert.ok(!existsSync(join(out, '_t', bogota.digest)), 'the old theme\'s files are gone')
  console.log(`test:static-theme: bogota ${bogota.digest.slice(0, 12)} -> starter ${starter.digest.slice(0, 12)}; a missing theme kept the first site`)
  status = 0
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
} finally {
  server.kill()
  rmSync(out, { recursive: true, force: true })
}
process.exit(status)
