// npm run test:static: generates the static site against the mock Strapi, then runs e2e/static on the output.
// STATIC_SKIP_GENERATE=1 reuses .output/public; STATIC_MOCK_PORT and STATIC_APP_PORT change the ports.
import { spawn, spawnSync } from 'node:child_process'

const mockPort = process.env.STATIC_MOCK_PORT ?? '4360'
const appPort = process.env.STATIC_APP_PORT ?? '3260'

function waitFor(url, attempts = 50) {
  return new Promise((resolve, reject) => {
    const tryOnce = (left) => {
      fetch(url).then(() => resolve(), () => (left > 0 ? setTimeout(() => tryOnce(left - 1), 200) : reject(new Error(`${url} did not answer`))))
    }
    tryOnce(attempts)
  })
}

// Resolves with the exit code of the generate (0 = ok)
async function generate() {
  const mock = spawn('node', ['e2e/mock-strapi.mjs'], {
    env: { ...process.env, MOCK_PORT: mockPort, MOCK_FRONTEND_URL: `http://127.0.0.1:${appPort}` },
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
        NUXT_PUBLIC_SITE_MODE: 'static',
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

if (!process.env.STATIC_SKIP_GENERATE) {
  const code = await generate().catch((error) => {
    console.error(error.message)
    return 1
  })
  if (code !== 0) {
    process.exitCode = code
    process.exit()
  }
}

const tests = spawnSync('npx', ['playwright', 'test', '-c', 'playwright.static.config.ts', ...process.argv.slice(2)], { stdio: 'inherit', env: process.env })
process.exit(tests.status ?? 1)
