import { expect } from '@playwright/test'
import type { APIRequestContext, Locator, Page } from '@playwright/test'

// The article of the mock Strapi with three SQL playgrounds (e2e/mock-strapi.mjs): a query, a loop that never ends, a 64 KB+ result
export const PLAYGROUND_ARTICLE = '/es/blog/guia-vue-composables'
export const PLAYGROUND_FREE_ARTICLE = '/blog/linux-server-hardening-guide'
export const QUERY = 0
export const LOOP = 1
export const BIG = 2

export function playground(page: Page, index: number): Locator {
  return page.locator('micelio-playground').nth(index)
}

export function runButton(page: Page, index: number): Locator {
  return playground(page, index).locator('[data-playground-run]')
}

export function stopButton(page: Page, index: number): Locator {
  return playground(page, index).locator('[data-playground-stop]')
}

export function resultOf(page: Page, index: number): Locator {
  return playground(page, index).locator('[data-playground-result]')
}

/** Opens the article and waits for the island to show the Run buttons. */
export async function openPlayground(page: Page, path: string = PLAYGROUND_ARTICLE): Promise<void> {
  await page.goto(path, { waitUntil: 'load' })
  await expect(runButton(page, QUERY)).toBeVisible()
}

/** Paths of the island's own files (its entry, /_islands/workers/ and /_islands/runtimes/) the browser asks for, from any context of the page (workers included). The loader the page declares is not one. */
export function trackRuntimeRequests(page: Page): string[] {
  const paths: string[] = []
  page.context().on('request', (request) => {
    const { pathname } = new URL(request.url())
    if (/^\/_islands\/(?:workers\/|runtimes\/|playground-)/.test(pathname)) paths.push(pathname)
  })
  return paths
}

/** The URL of the island's Worker script, read from the entry the page's JSON declaration names. */
export async function workerUrl(request: APIRequestContext, path: string = PLAYGROUND_ARTICLE): Promise<string> {
  const html = await (await request.get(path)).text()
  const island = /"src":"([^"]*\/_islands\/playground-[\w-]+\.js)"/.exec(html)?.[1]
  expect(island, 'the page declares the playground island').toBeTruthy()
  const source = await (await request.get(island!)).text()
  const worker = /workers\/(playground-[\w-]+\.js)/.exec(source)?.[1]
  expect(worker, 'the island names its Worker').toBeTruthy()
  return new URL(`workers/${worker}`, new URL(island!, 'http://localhost')).pathname
}

// A script that tries what a Worker with the playground's policy must not do; it reports what each attempt gave
export const PROBE_SCRIPT = `
const outcome = async (attempt) => {
  try { await attempt(); return 'allowed' } catch (error) { return 'blocked' }
}
self.onmessage = async (event) => {
  const origin = event.data.origin
  const report = {
    runtimes: await outcome(() => fetch('/_islands/runtimes/not-a-file.js')),
    sameOriginElsewhere: await outcome(() => fetch('/api/posts')),
    otherOrigin: await outcome(() => fetch(origin.replace('127.0.0.1', 'localhost') + '/', { mode: 'no-cors' })),
    evalCode: await outcome(() => eval('1 + 1')),
    newFunction: await outcome(() => new Function('return 1')()),
    webAssembly: await outcome(() => WebAssembly.compile(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]))),
  }
  self.postMessage(report)
}
`

export interface ProbeReport {
  runtimes: string
  sameOriginElsewhere: string
  otherOrigin: string
  evalCode: string
  newFunction: string
  webAssembly: string
}

/**
 * Starts a Worker whose body is PROBE_SCRIPT but whose response headers are the real ones of the island's Worker (the server or
 * `_headers` sends the CSP), so what it reports is what the browser enforces from that policy.
 */
export async function probeWorker(page: Page, realWorker: string): Promise<ProbeReport> {
  await page.route('**/_islands/workers/probe.js', async (route) => {
    const real = await route.fetch({ url: new URL(realWorker, page.url()).href })
    const headers = { ...real.headers(), 'content-type': 'text/javascript' }
    delete headers['content-length']
    delete headers['content-encoding']
    await route.fulfill({ status: 200, headers, body: PROBE_SCRIPT })
  })
  return page.evaluate(() => new Promise<ProbeReport>((resolve, reject) => {
    const worker = new Worker('/_islands/workers/probe.js', { type: 'module' })
    worker.onmessage = event => resolve(event.data as ProbeReport)
    worker.onerror = () => reject(new Error('the probe Worker failed to start'))
    worker.postMessage({ origin: location.origin })
  }))
}
