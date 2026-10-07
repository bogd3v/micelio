// Generates the static site against the mock Strapi (shared by scripts/test-static.mjs and scripts/perf/measure.mjs).
import { spawn, spawnSync } from 'node:child_process'

export function waitFor(url, attempts = 50) {
  return new Promise((resolve, reject) => {
    const tryOnce = (left) => {
      fetch(url).then(() => resolve(), () => (left > 0 ? setTimeout(() => tryOnce(left - 1), 200) : reject(new Error(`${url} did not answer`))))
    }
    tryOnce(attempts)
  })
}

/**
 * Runs `npm run generate` in `mode` (`static` or `landing`) with the mock Strapi up on `mockPort`, then stops the mock.
 * `extraEnv` goes to both processes (a theme, MOCK_DISPLAY_FONT). Resolves with the exit code of the generate (0 = ok).
 */
export async function generateStatic({ mockPort, appPort, mode = 'static', extraEnv = {} }) {
  const mock = spawn('node', ['e2e/mock-strapi.mjs'], {
    env: { ...process.env, ...extraEnv, MOCK_PORT: String(mockPort), MOCK_FRONTEND_URL: `http://127.0.0.1:${appPort}` },
    stdio: 'ignore',
  })
  // A mock that exits early (the port is taken) must not be mistaken for the one we wait for
  const exited = new Promise((_resolve, reject) => mock.once('exit', code => reject(new Error(`The mock Strapi exited with ${code} (is port ${mockPort} in use?)`))))
  exited.catch(() => {})
  try {
    await Promise.race([waitFor(`http://127.0.0.1:${mockPort}/api/site-setting`), exited])
    const result = spawnSync('npm', ['run', 'generate'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        ...extraEnv,
        NUXT_PUBLIC_SITE_MODE: mode,
        NUXT_PUBLIC_STRAPI_URL: `http://127.0.0.1:${mockPort}`,
        // Any value: the mock does not check it, the module only requires it
        NUXT_STRAPI_API_TOKEN: 'e2e-build-token',
        NUXT_PUBLIC_SITE_URL: 'https://bogdev.com.co',
        NUXT_MEDIA_URL: 'https://resources.bogdev.com.co',
        NUXT_PUBLIC_FEDIVERSE_HANDLE: '@bogdev@api.bogdev.com.co',
      },
    })
    return result.status ?? 1
  } finally {
    mock.kill()
  }
}
