// npm run test:landing: generates a landing site (NUXT_PUBLIC_SITE_MODE=landing) against the mock Strapi with a home page and no
// articles, runs e2e/landing on it, then generates it again with the starter theme and checks that the same page renders.
// LANDING_SKIP_GENERATE=1 reuses .output/public for the first run only; LANDING_SKIP_THEME=1 leaves the second build out;
// LANDING_MOCK_PORT and LANDING_APP_PORT change the ports.
import { spawn } from 'node:child_process'
import { generateStatic } from './lib/static-generate.mjs'

const mockPort = process.env.LANDING_MOCK_PORT ?? '4370'
const appPort = process.env.LANDING_APP_PORT ?? '3280'
// MOCK_NO_ARTICLES: no article, tag or category; MOCK_HOME_PAGE: the showcase page is the home page (e2e/mock-strapi.mjs)
const mockEnv = { MOCK_NO_ARTICLES: '1', MOCK_HOME_PAGE: '1' }

async function build(extraEnv = {}) {
  return generateStatic({ mockPort, appPort, mode: 'landing', extraEnv: { ...mockEnv, ...extraEnv } }).catch((error) => {
    console.error(error.message)
    return 1
  })
}

function playwright(env, args) {
  const tests = spawn('npx', ['playwright', 'test', '-c', 'playwright.landing.config.ts', ...args], { stdio: 'inherit', env: { ...process.env, ...env } })
  return new Promise(resolve => tests.once('exit', code => resolve(code ?? 1)))
}

const extra = process.argv.slice(2)

let status = process.env.LANDING_SKIP_GENERATE || (await build()) === 0 ? await playwright({}, extra) : 1

if (status === 0 && !process.env.LANDING_SKIP_THEME) {
  // Switching themes does not touch the page content (#244): the same page, another theme package
  status = (await build({ NUXT_PUBLIC_THEME: 'starter' })) === 0
    ? await playwright({ LANDING_THEME: 'starter' }, ['e2e/landing/theme.spec.ts', ...extra])
    : 1
}
process.exit(status)
