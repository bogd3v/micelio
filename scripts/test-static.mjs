// npm run test:static: generates the static site against the mock Strapi, then runs e2e/static on the output.
// STATIC_SKIP_GENERATE=1 reuses .output/public; STATIC_MOCK_PORT, STATIC_APP_PORT and STATIC_RECEIVER_PORT change the ports.
// The build gets a newsletter form action pointing at a receiver standing in for the provider.
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { generateStatic } from './lib/static-generate.mjs'

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

if (!process.env.STATIC_SKIP_GENERATE) {
  let code
  try {
    code = await generateStatic({
      mockPort,
      appPort,
      // The playground's Worker may fetch its runtime only from the site's own origin (ADR 0004)
      siteUrl: `http://127.0.0.1:${appPort}`,
      extraEnv: { NUXT_PUBLIC_NEWSLETTER_FORM_ACTION: `http://127.0.0.1:${receiverPort}/subscribe` },
    })
  } catch (error) {
    console.error(error.message)
    code = 1
  }
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
