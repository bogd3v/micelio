// Generates the static site against the mock Strapi (shared by scripts/test-static.mjs and scripts/perf/measure.mjs).
import { spawn, spawnSync } from 'node:child_process'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function waitFor(url, attempts = 50) {
  for (let left = attempts; ; left--) {
    try {
      await fetch(url)
      return
    } catch {
      if (left <= 0) throw new Error(`${url} did not answer`)
      await sleep(200)
    }
  }
}

/**
 * Runs `npm run generate` in `mode` (`static` or `landing`) with the mock Strapi up on `mockPort`, then stops the mock.
 * `extraEnv` goes to both processes (a theme, MOCK_DISPLAY_FONT). `siteUrl` is the site's origin: a run that serves the site elsewhere (127.0.0.1) passes it, because the Worker's CSP names it (ADR 0004). Resolves with the exit code of the generate (0 = ok).
 */
export async function generateStatic({ mockPort, appPort, mode = 'static', extraEnv = {}, siteUrl = 'https://bogdev.com.co' }) {
  const mock = spawn('node', ['e2e/mock-strapi.mjs'], {
    env: { ...process.env, ...extraEnv, MOCK_PORT: String(mockPort), MOCK_FRONTEND_URL: `http://127.0.0.1:${appPort}` },
    stdio: 'ignore',
  })
  // A mock that exits early (the port is taken) must not be mistaken for the one we wait for
  // Resolves with the error (never rejects), so a mock stopped by us at the end is not an unhandled rejection
  const exited = new Promise(resolve => mock.once('exit', code => resolve(new Error(`The mock Strapi exited with ${code} (is port ${mockPort} in use?)`))))
  try {
    const early = await Promise.race([waitFor(`http://127.0.0.1:${mockPort}/api/site-setting`), exited])
    if (early) throw early
    const result = spawnSync('npm', ['run', 'generate'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        ...extraEnv,
        NUXT_PUBLIC_SITE_MODE: mode,
        NUXT_PUBLIC_STRAPI_URL: `http://127.0.0.1:${mockPort}`,
        // Any value: the mock does not check it, the module only requires it
        NUXT_STRAPI_API_TOKEN: 'e2e-build-token',
        NUXT_PUBLIC_SITE_URL: siteUrl,
        NUXT_MEDIA_URL: 'https://resources.bogdev.com.co',
        NUXT_PUBLIC_FEDIVERSE_HANDLE: '@bogdev@api.bogdev.com.co',
      },
    })
    return result.status ?? 1
  } finally {
    mock.kill()
  }
}
