#!/usr/bin/env node
// Measures page weight and Lighthouse metrics against the budgets in budgets.json.
// See docs/performance.md for what each number means and how budgets change.
import { spawn } from 'node:child_process'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { brotliDecompressSync, gunzipSync, gzipSync } from 'node:zlib'
import { chromium } from '@playwright/test'
import lighthouse from 'lighthouse'
import { checkFouc } from './fouc.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const MOCK_PORT = 4310
const SERVER_PORT = 3211
const DEBUG_PORT = 9223
// Mirrors DEFAULT_THEME in modules/theme/themes.ts (a .ts file this script cannot import)
const DEFAULT_THEME = 'bogota'
const FONT_URL = /url\(\s*['"]?([^'")]+\.(?:woff2?|ttf|otf))/g

const args = parseArgs(process.argv.slice(2))
const budgets = JSON.parse(readFileSync(new URL('./budgets.json', import.meta.url), 'utf8'))
const base = args.base ?? `http://127.0.0.1:${SERVER_PORT}`
const runs = Number(args.runs ?? 3)
// The build under test: --theme and --mode label the report; the server gets the theme it was built with
const theme = typeof args.theme === 'string' ? args.theme : process.env.NUXT_PUBLIC_THEME || DEFAULT_THEME
const mode = typeof args.mode === 'string' ? args.mode : budgets.mode
const label = `theme ${theme}, ${mode} mode`
if (mode !== budgets.mode) throw new Error(`budgets.json has budgets for the "${budgets.mode}" mode only, not "${mode}" (${label})`)
const exception = budgets.themes?.[theme]
for (const [id, entry] of Object.entries(budgets.themes ?? {})) {
  if (!entry?.reason) throw new Error(`budgets.json: the exception for theme "${id}" needs a "reason"`)
  if (!existsSync(new URL(`../../themes/${id}/theme.json`, import.meta.url))) console.warn(`warn  budgets.json: "themes.${id}" is not an installed theme in themes/`)
}

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
    ...({ NUXT_PUBLIC_THEME: theme }),
    NUXT_PUBLIC_STRAPI_URL: `http://127.0.0.1:${MOCK_PORT}`,
    NUXT_PUBLIC_SITE_URL: base,
    NUXT_PUBLIC_UMAMI_WEBSITE_ID: '',
    NUXT_MEDIA_URL: 'https://resources.bogdev.com.co',
    NUXT_PUBLIC_FEDIVERSE_HANDLE: '@bogdev@api.bogdev.com.co',
    NUXT_PUBLIC_FEDIVERSE_ACTOR_URL: 'https://api.bogdev.com.co/fediverse/user/devbog',
    NUXT_PUBLIC_FEDIVERSE_ARTICLES_URL: 'https://api.bogdev.com.co/fediverse/articles',
    // A full SMTP setting keeps the newsletter module on; nothing is sent
    NUXT_SMTP_HOST: '127.0.0.1',
    NUXT_SMTP_PORT: '1',
    NUXT_SMTP_USER: 'test',
    NUXT_SMTP_PASS: 'test',
    NUXT_NEWSLETTER_FROM: 'BogDev <no-reply@bogdev.test>',
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

function fetchAsSent(url) {
  const request = url.startsWith('https:') ? httpsRequest : httpRequest
  return new Promise((resolve, reject) => {
    request(url, { headers: { 'accept-encoding': 'br, gzip' } }, (res) => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        const raw = Buffer.concat(chunks)
        const encoding = res.headers['content-encoding']
        const body = encoding === 'br' ? brotliDecompressSync(raw) : encoding === 'gzip' ? gunzipSync(raw) : raw
        resolve({ sent: raw.length, gzip: gzipSync(body).length, text: body.toString('utf8') })
      })
      res.on('error', reject)
    }).on('error', reject).end()
  })
}

function attribute(tag, name) {
  return tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]
}

function declaredAssets(html, pageUrl) {
  const scripts = new Set()
  const stylesheets = new Set()
  const fonts = new Set()
  for (const tag of html.match(/<script\b[^>]*>/g) ?? []) {
    const src = attribute(tag, 'src')
    if (src) scripts.add(new URL(src, pageUrl).href)
  }
  for (const tag of html.match(/<link\b[^>]*>/g) ?? []) {
    const href = attribute(tag, 'href')
    const rel = attribute(tag, 'rel')
    if (!href) continue
    if (rel === 'modulepreload') scripts.add(new URL(href, pageUrl).href)
    if (rel === 'stylesheet') stylesheets.add(new URL(href, pageUrl).href)
    if (rel === 'preload' && attribute(tag, 'as') === 'font') fonts.add(new URL(href, pageUrl).href)
  }
  return { scripts, stylesheets, fonts }
}

async function measureWeight(url) {
  const page = await fetchAsSent(url)
  const { scripts, stylesheets, fonts } = declaredAssets(page.text, url)
  const total = async urls => (await Promise.all([...urls].map(fetchAsSent))).reduce(
    (sum, asset) => ({ sent: sum.sent + asset.sent, gzip: sum.gzip + asset.gzip, texts: [...sum.texts, asset.text] }),
    { sent: 0, gzip: 0, texts: [] },
  )
  const js = await total(scripts)
  const css = await total(stylesheets)
  ;[...stylesheets].forEach((cssUrl, i) => {
    for (const [, fontPath] of css.texts[i].matchAll(FONT_URL)) fonts.add(new URL(fontPath, cssUrl).href)
  })
  const font = await total(fonts)
  const kb = value => Math.round(value / 102.4) / 10
  return {
    jsKb: kb(js.sent), cssKb: kb(css.sent), htmlKb: kb(page.sent), fontKb: kb(font.sent),
    jsGzipKb: kb(js.gzip), cssGzipKb: kb(css.gzip), htmlGzipKb: kb(page.gzip),
    html: page.text, stylesheets: new Map([...stylesheets].map((href, i) => [href, css.texts[i]])),
  }
}

async function countThirdParty(browser, url) {
  const context = await browser.newContext({ viewport: { width: 412, height: 823 }, isMobile: true })
  const page = await context.newPage()
  const firstParty = new Set([new URL(url).origin, ...(budgets.firstPartyOrigins ?? [])])
  const thirdParty = []
  page.on('request', (request) => {
    const requestUrl = request.url()
    if (/^https?:/.test(requestUrl) && !firstParty.has(new URL(requestUrl).origin)) thirdParty.push(requestUrl)
  })
  await page.goto(url, { waitUntil: 'networkidle' })
  await context.close()
  return { thirdPartyRequests: thirdParty.length, thirdPartyUrls: thirdParty }
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

/** The limits of a page and level; a recorded exception for the theme overrides single metrics */
function limitsFor(page, level) {
  const global = budgets.limits[page]?.[level] ?? {}
  return { ...global, ...(exception?.limits?.[page]?.[level] ?? {}) }
}

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
    const { html, stylesheets, ...weight } = await measureWeight(url)
    const metrics = { ...weight, ...(await countThirdParty(browser, url)), ...(await measureLighthouse(url)) }
    problems.push(...compare(name, metrics, limitsFor(name, 'error'), 'error'), ...compare(name, metrics, limitsFor(name, 'warn'), 'warn'))
    for (const message of checkFouc(html, url, stylesheets)) problems.push({ level: 'error', page: name, message })
    report.push({ page: name, path, metrics })
    const { thirdPartyUrls, ...printable } = metrics
    console.log(`${name.padEnd(10)} ${JSON.stringify(printable)}`)
    if (thirdPartyUrls.length) console.log(`           third party: ${thirdPartyUrls.join(', ')}`)
  }

  if (args.out) writeFileSync(args.out, JSON.stringify({ theme, mode, pages: report }, null, 2) + '\n')
  const lines = problems.map((p) => {
    const prefix = `${p.level === 'error' ? 'ERROR' : 'warn '} [${label}] ${p.page}:`
    if (p.message) return `${prefix} FOUC: ${p.message}`
    const verb = HIGHER_IS_BETTER.has(p.metric) ? 'is below' : 'exceeds'
    return `${prefix} ${p.metric} ${p.value} ${verb} the budget of ${p.limit}`
  })
  if (lines.length) console.log('\n' + lines.join('\n'))
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Performance (${label})\n\n${exception ? `Recorded exception: ${exception.reason}\n\n` : ''}${summaryTable(report)}\n\n${lines.map(l => `- ${l}`).join('\n')}\n`)
  }
  if (args.check && problems.some(p => p.level === 'error')) process.exitCode = 1
} finally {
  await browser?.close()
  for (const server of servers) server.kill()
}
