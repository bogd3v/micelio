// npm run test:static: generates the static site against the mock Strapi, then runs e2e/static on the output.
// STATIC_SKIP_GENERATE=1 reuses .output/public; STATIC_MOCK_PORT, STATIC_APP_PORT and STATIC_RECEIVER_PORT change the ports.
// The build gets a newsletter form action pointing at a receiver standing in for the provider.
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:http'

const mockPort = process.env.STATIC_MOCK_PORT ?? '4360'
const appPort = process.env.STATIC_APP_PORT ?? '3260'
const receiverPort = process.env.STATIC_RECEIVER_PORT ?? '3270'

// Stands in for the newsletter provider: keeps the last POST (GET /last) and answers with a 303 to its own origin
const posts = []
const receiver = createServer((request, response) => {
  if (request.method === 'POST' && request.url === '/subscribe') {
    let body = ''
    request.on('data', chunk => (body += chunk))
    request.on('end', () => {
      posts.push(body)
      response.writeHead(303, { location: '/thanks' }).end()
    })
  } else if (request.url === '/thanks') {
    response.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>Thanks</title><h1>Check your email</h1>')
  } else if (request.url === '/last') {
    response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(posts.at(-1) ?? null))
  } else {
    response.writeHead(404).end()
  }
})

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
        NUXT_PUBLIC_NEWSLETTER_FORM_ACTION: `http://127.0.0.1:${receiverPort}/subscribe`,
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

await new Promise((resolve, reject) => receiver.once('error', reject).listen(Number(receiverPort), '127.0.0.1', resolve))
// Async, not spawnSync: the receiver lives in this process and must keep answering
const tests = spawn('npx', ['playwright', 'test', '-c', 'playwright.static.config.ts', ...process.argv.slice(2)], { stdio: 'inherit', env: process.env })
const status = await new Promise(resolve => tests.once('exit', code => resolve(code ?? 1)))
receiver.close()
process.exit(status)
