#!/usr/bin/env node
// Measures page weight and Lighthouse metrics against the budgets in budgets.json.
// See docs/performance.md for what each number means and how budgets change.
import { spawn } from 'node:child_process'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { chromium } from '@playwright/test'
import lighthouse from 'lighthouse'

const ROOT = new URL('../../', import.meta.url).pathname
const MOCK_PORT = 4310
const SERVER_PORT = 3211
const DEBUG_PORT = 9223
const WEIGHT_TYPES = { script: 'js', stylesheet: 'css', document: 'html', font: 'font' }

const args = parseArgs(process.argv.slice(2))
const budgets = JSON.parse(readFileSync(new URL('./budgets.json', import.meta.url), 'utf8'))
const base = args.base ?? `http://127.0.0.1:${SERVER_PORT}`
const runs = Number(args.runs ?? 3)

function parseArgs(list) {
  const parsed = {}
  for (let i = 0; i < list.length; i++) {
    const key = list[i].replace(/^--/, '')
    const next = list[i + 1]
    if (next && !next.startsWith('--')) {
      parsed[key] = next
      i++
    } else parsed[key] = true
  }
  return parsed
}

function startServers() {
  const env = {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(SERVER_PORT),
    NUXT_PUBLIC_STRAPI_URL: `http://127.0.0.1:${MOCK_PORT}`,
    NUXT_PUBLIC_SITE_URL: base,
    NUXT_PUBLIC_UMAMI_WEBSITE_ID: '',
  }
  return [
    spawn('node', ['e2e/mock-strapi.mjs'], { cwd: ROOT, env, stdio: 'ignore' }),
    spawn('node', ['.output/server/index.mjs'], { cwd: ROOT, env, stdio: 'ignore' }),
  ]
}

async function waitFor(url, timeoutMs = 30000) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    const res = await fetch(url).catch(() => null)
    if (res && res.status < 500) return
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`${url} did not respond within ${timeoutMs} ms`)
}

async function measureWeight(browser, url) {
  const context = await browser.newContext({ viewport: { width: 412, height: 823 }, isMobile: true })
  const page = await context.newPage()
  const firstParty = new Set([new URL(url).origin, ...(budgets.firstPartyOrigins ?? [])])
  const sent = { js: 0, css: 0, html: 0, font: 0 }
  const gzip = { js: 0, css: 0, html: 0, font: 0 }
  const pending = []
  const thirdParty = []
  page.on('response', (response) => {
    const responseUrl = response.url()
    if (!responseUrl.startsWith('data:') && !firstParty.has(new URL(responseUrl).origin)) thirdParty.push(responseUrl)
    const kind = WEIGHT_TYPES[response.request().resourceType()]
    if (!kind) return
    pending.push(Promise.all([response.request().sizes(), response.body()]).then(([sizes, body]) => {
      sent[kind] += sizes.responseBodySize
      gzip[kind] += gzipSync(body).length
    }).catch(() => {}))
  })
  await page.goto(url, { waitUntil: 'networkidle' })
  await Promise.all(pending)
  await context.close()
  const kb = value => Math.round(value / 102.4) / 10
  return {
    jsKb: kb(sent.js), cssKb: kb(sent.css), htmlKb: kb(sent.html), fontKb: kb(sent.font),
    jsGzipKb: kb(gzip.js), cssGzipKb: kb(gzip.css), htmlGzipKb: kb(gzip.html),
    thirdPartyRequests: thirdParty.length, thirdPartyUrls: thirdParty,
  }
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

async function measureLighthouse(url) {
  const samples = []
  for (let i = 0; i < runs; i++) {
    const result = await lighthouse(url, {
      port: DEBUG_PORT,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance', 'accessibility'],
    })
    const { audits, categories } = result.lhr
    samples.push({
      lcpMs: Math.round(audits['largest-contentful-paint'].numericValue),
      tbtMs: Math.round(audits['total-blocking-time'].numericValue),
      cls: Math.round(audits['cumulative-layout-shift'].numericValue * 1000) / 1000,
      performance: Math.round(categories.performance.score * 100),
      accessibility: Math.round(categories.accessibility.score * 100),
    })
  }
  return Object.fromEntries(Object.keys(samples[0]).map(key => [key, median(samples.map(s => s[key]))]))
}

const HIGHER_IS_BETTER = new Set(['performance', 'accessibility'])

function compare(page, metrics, limits, level) {
  return Object.entries(limits ?? {}).flatMap(([metric, limit]) => {
    const value = metrics[metric]
    const over = HIGHER_IS_BETTER.has(metric) ? value < limit : value > limit
    return over ? [{ level, page, metric, value, limit }] : []
  })
}

function summaryTable(report) {
  const columns = ['jsKb', 'jsGzipKb', 'cssKb', 'htmlKb', 'fontKb', 'thirdPartyRequests', 'lcpMs', 'tbtMs', 'cls', 'performance', 'accessibility']
  const lines = [`| Page | ${columns.join(' | ')} |`, `| --- | ${columns.map(() => '---:').join(' | ')} |`]
  for (const row of report) lines.push(`| ${row.page} | ${columns.map(c => row.metrics[c]).join(' | ')} |`)
  return lines.join('\n')
}

const servers = args.serve ? startServers() : []
let browser
try {
  if (args.serve) {
    await waitFor(`http://127.0.0.1:${MOCK_PORT}/api/articles`)
    await waitFor(base)
  }
  browser = await chromium.launch({ channel: 'chromium', args: [`--remote-debugging-port=${DEBUG_PORT}`] })
  const report = []
  const problems = []
  for (const { name, path } of budgets.pages) {
    const url = new URL(path, base).href
    await fetch(url)
    const metrics = { ...(await measureWeight(browser, url)), ...(await measureLighthouse(url)) }
    const limits = budgets.limits[name] ?? {}
    problems.push(...compare(name, metrics, limits.error, 'error'), ...compare(name, metrics, limits.warn, 'warn'))
    report.push({ page: name, path, metrics })
    const { thirdPartyUrls, ...printable } = metrics
    console.log(`${name.padEnd(10)} ${JSON.stringify(printable)}`)
    if (thirdPartyUrls.length) console.log(`           third party: ${thirdPartyUrls.join(', ')}`)
  }

  if (args.out) writeFileSync(args.out, JSON.stringify(report, null, 2) + '\n')
  const lines = problems.map((p) => {
    const verb = HIGHER_IS_BETTER.has(p.metric) ? 'is below' : 'exceeds'
    return `${p.level === 'error' ? 'ERROR' : 'warn '} ${p.page}: ${p.metric} ${p.value} ${verb} the budget of ${p.limit}`
  })
  if (lines.length) console.log('\n' + lines.join('\n'))
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Performance (${budgets.mode} mode)\n\n${summaryTable(report)}\n\n${lines.map(l => `- ${l}`).join('\n')}\n`)
  }
  if (args.check && problems.some(p => p.level === 'error')) process.exitCode = 1
} finally {
  await browser?.close()
  for (const server of servers) server.kill()
}
