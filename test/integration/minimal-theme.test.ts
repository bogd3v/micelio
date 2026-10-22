import { describe, expect, it } from 'vitest'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { fetch, setup, useTestContext } from '@nuxt/test-utils/e2e'
import { startMockStrapi } from './mock-strapi'

// A build with its own theme: one light mode, no slots, no layout (#237, acceptance criteria).
// MICELIO_THEME_DIRS points at the fixtures; the build reads NUXT_PUBLIC_THEME for its own theme and the server for its default.
const mock = await startMockStrapi()
process.env.NUXT_PUBLIC_STRAPI_URL = mock.url
process.env.NUXT_PUBLIC_SITE_URL = 'https://minimal.test'
process.env.NUXT_STRAPI_API_TOKEN = 'test-api-token'
process.env.NUXT_SITE_CACHE_SECONDS = '0'
process.env.MICELIO_THEME_DIRS = 'test/fixtures/themes'
process.env.NUXT_PUBLIC_THEME = 'minimal'

await setup({
  server: true,
  setupTimeout: 600_000,
  nuxtConfig: {
    nitro: { prerender: { crawlLinks: false } },
  },
})

describe('a build with the minimal fixture theme', () => {
  it('writes the theme\'s only mode and its scheme on <html>', async () => {
    const html = await (await fetch('/')).text()
    expect(html).toMatch(/<html[^>]* data-theme="day" data-scheme="light"/)
  })

  it('renders without the mode switch', async () => {
    for (const path of ['/', '/blog', '/privacy']) {
      const html = await (await fetch(path)).text()
      expect(html, path).not.toContain('data-mode=')
      expect(html, path).toContain('myc-header')
    }
  })

  it('uses the core defaults for every slot', async () => {
    const html = await (await fetch('/')).text()
    expect(html).not.toContain('bogota-')
    // ThemeMark default
    expect(html).toMatch(/<a [^>]*class="[^"]*myc-brand"[^>]*><span aria-hidden="true">[^<]+<\/span><\/a>/)
  })

  it('shows no place line, which a theme provides through its messages', async () => {
    const html = await (await fetch('/')).text()
    for (const hook of ['myc-hud"', 'myc-hero-place']) expect(html).not.toContain(hook)
    for (const place of ['4.61°N', 'Made in Bogot', '2,640 m a.s.l.']) expect(html).not.toContain(place)
  })

  it('draws no progress marker and no bird on the coffee cup on an article', async () => {
    const html = await (await fetch('/blog/understanding-vue-composables')).text()
    expect(html).toContain('class="myc-progress-bar"')
    expect(html).toContain('myc-coffee-cup')
    for (const art of ['myc-progress-track', 'bogota-', 'myc-perch']) expect(html).not.toContain(art)
  })

  it('uses the core\'s neutral texts where Bogota brings its own', async () => {
    const html = await (await fetch('/')).text()
    expect(html).toContain('Browse by topic')
    for (const flavour of ['savanna', 'Field guide', 'Pinchaflor']) expect(html).not.toContain(flavour)
  })

  it('serves the theme\'s roles and the core\'s optional-role defaults', async () => {
    const html = await (await fetch('/')).text()
    const href = html.match(/href="([^"]+\.css)"/)?.[1]
    expect(href).toBeTruthy()
    const css = await (await fetch(href!)).text()
    expect(css).toContain('color-scheme:light')
    expect(css).not.toContain('Archivo')
    expect(css).toContain('--glow-link:none')
  })

  it('keeps the first variant of every region', async () => {
    const html = await (await fetch('/')).text()
    for (const variant of ['bar', 'showcase', 'columns']) expect(html).toContain(`data-layout="${variant}"`)
  })
})

/** Starts the build's own server entry on a free port with `env` added, and returns its address and a stop function. */
async function startServer(env: Record<string, string>): Promise<{ origin: string, stop: () => Promise<void> }> {
  const output = useTestContext().nuxt!.options.nitro.output!.dir!
  const probe = createServer()
  await new Promise<void>(listening => probe.listen(0, '127.0.0.1', listening))
  const { port } = probe.address() as AddressInfo
  await new Promise(closed => probe.close(closed))
  const child = spawn(process.execPath, [join(output, 'server/index.mjs')], {
    env: { ...process.env, ...env, PORT: String(port), NITRO_HOST: '127.0.0.1', NITRO_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  child.stdout.on('data', chunk => (log += chunk))
  child.stderr.on('data', chunk => (log += chunk))
  const origin = `http://127.0.0.1:${port}`
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`The server exited:\n${log}`)
    try {
      if ((await globalThis.fetch(`${origin}/privacy`)).ok) break
    } catch {
      // Not listening yet
    }
    await new Promise(wait => setTimeout(wait, 200))
  }
  return {
    origin,
    stop: async () => {
      child.kill()
      await new Promise(exited => child.once('exit', exited))
    },
  }
}

describe('NUXT_PUBLIC_THEME at runtime, on the one build', () => {
  const output = (): string => useTestContext().nuxt!.options.nitro.output!.dir!
  function digestOf(id: string): string {
    const index = JSON.parse(readFileSync(join(output(), 'server/micelio/store/index.json'), 'utf8')) as { themes: Record<string, { digest: string }> }
    return index.themes[id]!.digest
  }

  /** Starts the server with `env`, and returns the digests of the page's payload and of the files `/_t/` serves for each theme. */
  async function boot(env: Record<string, string>): Promise<{ page: string, served: Record<string, number> }> {
    const server = await startServer(env)
    try {
      const page = await (await globalThis.fetch(`${server.origin}/`)).text()
      const served: Record<string, number> = {}
      for (const id of ['minimal', 'data-only']) served[id] = (await globalThis.fetch(`${server.origin}/_t/${digestOf(id)}/theme.css`)).status
      return { page, served }
    } finally {
      await server.stop()
    }
  }

  it('starts with either of two data-only themes, with no rebuild, and serves only the one it started with', async () => {
    const minimal = await boot({ NUXT_PUBLIC_THEME: 'minimal' })
    expect(minimal.page).toContain(digestOf('minimal'))
    expect(minimal.page).not.toContain(digestOf('data-only'))
    expect(minimal.page).toContain(`href="/_t/${digestOf('minimal')}/theme.css"`)
    expect(minimal.served).toEqual({ 'minimal': 200, 'data-only': 404 })
    const dataOnly = await boot({ NUXT_PUBLIC_THEME: 'data-only' })
    expect(dataOnly.page).toContain(digestOf('data-only'))
    expect(dataOnly.page).not.toContain(digestOf('minimal'))
    expect(dataOnly.page).toContain(`href="/_t/${digestOf('data-only')}/theme.css"`)
    expect(dataOnly.served).toEqual({ 'minimal': 404, 'data-only': 200 })
  })

  it('uses the build\'s theme when the variable is blank', async () => {
    expect((await boot({ NUXT_PUBLIC_THEME: '' })).served).toEqual({ 'minimal': 200, 'data-only': 404 })
  })

  it('refuses to boot, naming the variable, when the theme is not in the build', async () => {
    await expect(startServer({ NUXT_PUBLIC_THEME: 'nope' })).rejects.toThrow(/NUXT_PUBLIC_THEME is "nope"/)
  })
})
