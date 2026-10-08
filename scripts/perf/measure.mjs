#!/usr/bin/env node
// Measures page weight and Lighthouse metrics against the budgets in budgets.json.
// See docs/performance.md for what each number means and how budgets change.
import { spawn } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { brotliDecompressSync, gunzipSync, gzipSync } from 'node:zlib'
import { chromium } from '@playwright/test'
import { createJiti } from 'jiti'
import lighthouse from 'lighthouse'
import { generateStatic } from '../lib/static-generate.mjs'
import { checkFouc } from './fouc.mjs'
import { ISLANDS_PREFIX, islandBudgetErrors, islandElement, islandMetrics, islandProblems, isStrayRequest } from './islands.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
// PERF_*_PORT: another set of ports when these are taken (parallel runs on one machine)
const MOCK_PORT = Number(process.env.PERF_MOCK_PORT ?? 4310)
const SERVER_PORT = Number(process.env.PERF_SERVER_PORT ?? 3211)
const DEBUG_PORT = Number(process.env.PERF_DEBUG_PORT ?? 9223)
// Mirrors DEFAULT_THEME in modules/theme/themes.ts (a .ts file this script cannot import)
const DEFAULT_THEME = 'bogota'
// Written after a static generate: which theme and mode the output belongs to
const BUILD_MARKER = join(ROOT, '.output', 'perf-build.json')
const FONT_URL = /url\(\s*['"]?([^'")]+\.(?:woff2?|ttf|otf))/g

const args = parseArgs(process.argv.slice(2))
const budgets = JSON.parse(readFileSync(new URL('./budgets.json', import.meta.url), 'utf8'))
const base = args.base ?? `http://127.0.0.1:${SERVER_PORT}`
const runs = Number(args.runs ?? 3)
// The build under test: --theme and --mode label the report; the server gets the theme it was built with
const theme = typeof args.theme === 'string' ? args.theme : process.env.NUXT_PUBLIC_THEME || DEFAULT_THEME
const mode = typeof args.mode === 'string' ? args.mode : process.env.PERF_MODE || 'dynamic'
// `landing` is `static` with a content profile (ADR 0006, section 2): same build, its own budgets
const budgetMode = budgets.aliases?.[mode] ?? mode
const modeBudgets = budgets.modes?.[budgetMode]
const isStatic = budgetMode === 'static' || budgetMode === 'landing'
// --display-font <id|heaviest>: the site picks a curated display font (ADR 0005, sections 8 and 9); that run's font limit is the theme's plus the file's allowance
// --search-query <text>: what the search island types; it must have a result on the site under test
const searchQuery = typeof args['search-query'] === 'string' ? args['search-query'] : 'vue'
const displayFont = args['display-font'] === 'heaviest' ? heaviestDisplayFont() : typeof args['display-font'] === 'string' ? args['display-font'] : undefined
const extraFontKb = displayFont ? budgets.displayFont?.extraFontKb ?? 60 : 0
const label = `theme ${theme}, ${mode} mode${displayFont ? `, display font ${displayFont}` : ''}`
if (!modeBudgets) throw new Error(`budgets.json has budgets for the modes ${Object.keys(budgets.modes).join(', ')}, not "${mode}" (${label})`)
// --pages home,article=/posts/x: measure these pages only; `name=path` points a budgeted page at another path (a real site, not the mock)
const pages = pagesToMeasure(args.pages)
// A recorded exception applies to every mode unless it names one
const exception = budgets.themes?.[theme] && [budgets.themes[theme].mode ?? budgetMode].flat().includes(budgetMode) ? budgets.themes[theme] : undefined
// The heavy registry is TypeScript; every island in it needs a budget, and every heavy budget an island
const { HEAVY_ISLANDS } = await createJiti(import.meta.url).import('../../app/islands/heavy.ts')
const budgetErrors = islandBudgetErrors(HEAVY_ISLANDS, budgets.modes)
if (budgetErrors.length) throw new Error(`budgets.json:\n${budgetErrors.join('\n')}`)
const heavyIslands = HEAVY_ISLANDS.filter(island => modeBudgets.islands?.[island.budget])
for (const [id, entry] of Object.entries(budgets.themes ?? {})) {
  if (!entry?.reason) throw new Error(`budgets.json: the exception for theme "${id}" needs a "reason"`)
  if (!existsSync(new URL(`../../themes/${id}/theme.json`, import.meta.url))) console.warn(`warn  budgets.json: "themes.${id}" is not an installed theme in themes/`)
}

/** The budgeted pages of the mode, narrowed and re-pathed by `--pages` */
function pagesToMeasure(list) {
  if (typeof list !== 'string') return modeBudgets.pages
  return list.split(',').filter(Boolean).map((entry) => {
    const [name, path] = entry.split('=')
    const known = modeBudgets.pages.find(page => page.name === name)
    if (!known && !path) throw new Error(`--pages: "${name}" is not a page of the ${budgetMode} budgets (${modeBudgets.pages.map(page => page.name).join(', ')}); give its path as name=/path`)
    return { name, path: path ?? known.path }
  })
}

/** The id of the largest file in app/assets/fonts/display/ */
function heaviestDisplayFont() {
  const dir = new URL('../../app/assets/fonts/display/', import.meta.url)
  const [heaviest] = readdirSync(dir).filter(file => file.endsWith('.woff2'))
    .map(file => ({ id: file.replace(/-latin-wght\.woff2$/, ''), size: statSync(new URL(file, dir)).size }))
    .sort((a, b) => b.size - a.size)
  if (!heaviest) throw new Error('app/assets/fonts/display/ has no font')
  return heaviest.id
}

/** The theme's own display family from its manifest, to tell whether the override emits anything */
function themeDisplayFamily() {
  const file = new URL(`../../themes/${theme}/theme.json`, import.meta.url)
  if (!existsSync(file)) return undefined
  const stack = JSON.parse(readFileSync(file, 'utf8')).type?.families?.display ?? ''
  return stack.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase()
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

function startStaticServer() {
  // The site is the generated output: nothing else runs. COMPRESS=1 makes the server answer like a CDN
  return spawn('node', ['scripts/static-serve.mjs', '.output/public'], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(SERVER_PORT), COMPRESS: '1' },
    stdio: 'ignore',
  })
}

function startServers() {
  const env = {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(SERVER_PORT),
    NUXT_PUBLIC_THEME: theme,
    MOCK_PORT: String(MOCK_PORT),
    NUXT_PUBLIC_STRAPI_URL: `http://127.0.0.1:${MOCK_PORT}`,
    NUXT_PUBLIC_SITE_URL: base,
    ...(displayFont && { MOCK_DISPLAY_FONT: displayFont }),
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

/** Waits for the url; fails at once if one of the children we started exits (a foreign server on the port would answer instead) */
async function waitFor(url, children = [], timeoutMs = 30000) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    const dead = children.find(child => child.exitCode !== null)
    if (dead) throw new Error(`a server exited with ${dead.exitCode} while waiting for ${url} (is the port in use?)`)
    let res
    try {
      res = await fetch(url)
    } catch {
      res = null
    }
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
  // Inline scripts (the theme init) run before first paint too, so they count towards the initial JS
  const inline = [...page.text.matchAll(/<script\b(?![^>]*\ssrc=)(?![^>]*type="application\/(?:ld\+)?json")[^>]*>([\s\S]*?)<\/script>/g)].map(match => gzipSync(match[1]).length)
  return {
    jsKb: kb(js.sent), cssKb: kb(css.sent), htmlKb: kb(page.sent), fontKb: kb(font.sent),
    jsGzipKb: kb(js.gzip), cssGzipKb: kb(css.gzip), htmlGzipKb: kb(page.gzip),
    initialJsGzKb: kb(js.gzip + inline.reduce((sum, size) => sum + size, 0)),
    declaredScripts: [...scripts].map(src => new URL(src).pathname),
    html: page.text, stylesheets: new Map([...stylesheets].map((href, i) => [href, css.texts[i]])),
  }
}

/** Loads the page the way a visitor does and lists what it asked for: third parties, scripts, and what only an island may load */
async function observeLoad(browser, url, declaredScripts) {
  const context = await browser.newContext({ viewport: { width: 412, height: 823 }, isMobile: true })
  const page = await context.newPage()
  const firstParty = new Set([new URL(url).origin, `http://127.0.0.1:${MOCK_PORT}`, ...(budgets.firstPartyOrigins ?? [])])
  const thirdParty = []
  const stray = []
  let loaded = false
  page.once('load', () => {
    loaded = true
  })
  // Context-wide, so a worker's requests count too
  context.on('request', (request) => {
    const requestUrl = request.url()
    if (!/^https?:/.test(requestUrl)) return
    if (!firstParty.has(new URL(requestUrl).origin)) thirdParty.push(requestUrl)
    const { pathname } = new URL(requestUrl)
    // ADR 0006, section 6: no island byte in the initial load, no Pagefind before the search is used
    if (isStrayRequest({ pathname, beforeLoad: !loaded, isStatic, declaredScripts })) stray.push(pathname)
  })
  await page.goto(url, { waitUntil: 'networkidle' })
  await context.close()
  return { thirdPartyRequests: thirdParty.length, thirdPartyUrls: thirdParty, strayRequests: stray.length, strayUrls: stray }
}

/** Resolves once no request has been in flight for `quietMs`; a load state that was already reached would resolve at once */
function trackQuiet(context) {
  let inflight = 0
  let last = Date.now()
  const done = () => {
    inflight = Math.max(0, inflight - 1)
    last = Date.now()
  }
  context.on('request', () => {
    inflight++
    last = Date.now()
  })
  context.on('requestfinished', done)
  context.on('requestfailed', done)
  return {
    // Restarts the quiet window, so a trigger whose requests start late is waited for
    mark: () => {
      last = Date.now()
    },
    wait: async (quietMs = 500, timeoutMs = 60000) => {
      const end = Date.now() + timeoutMs
      while (inflight > 0 || Date.now() - last < quietMs) {
        if (Date.now() > end) throw new Error(`requests still in flight after ${timeoutMs} ms`)
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    },
  }
}

/**
 * Loads the island's fixture page, checks that nothing of it loaded before its trigger, fires the trigger
 * (scrolls to the element, or clicks its control) and measures every file of /_islands/ requested from then on
 */
async function measureHeavyIsland(browser, island, budget) {
  const url = new URL(budget.page, base).href
  const declaredScripts = [...declaredAssets((await fetchAsSent(url)).text, url).scripts].map(src => new URL(src).pathname)
  const context = await browser.newContext({ viewport: { width: 412, height: 823 }, isMobile: true })
  const quiet = trackQuiet(context)
  const page = await context.newPage()
  const before = []
  const after = []
  let triggered = false
  context.on('request', (request) => {
    const { origin, pathname } = new URL(request.url())
    if (origin !== new URL(url).origin || !pathname.startsWith(ISLANDS_PREFIX)) return
    if (!triggered && !declaredScripts.includes(pathname)) before.push(pathname)
    if (triggered) after.push(pathname)
  })
  try {
    await page.goto(url, { waitUntil: 'load' })
    await quiet.wait()
    const element = islandElement(island)
    if (!(await page.locator(element).count())) return { problem: `${budget.page} has no <${element}>` }
    triggered = true
    quiet.mark()
    if (island.trigger === 'visible') await page.locator(element).first().scrollIntoViewIfNeeded()
    else await page.locator(budget.control ?? element).first().click()
    await page.locator(budget.ready).first().waitFor({ timeout: 60000 })
    await quiet.wait()
  } catch (error) {
    return { problem: `${budget.page}: ${error.message.split('\n')[0]}` }
  } finally {
    await context.close()
  }
  if (!after.length) return { problem: `${budget.page}: nothing of /_islands/ loaded after the trigger${before.length ? ` (before it: ${before.join(', ')})` : ''}` }
  const files = await Promise.all([...new Set(after)].map(async path => ({ path, ...(await fetchAsSent(new URL(path, url).href)) })))
  // Never modulepreloaded: neither its entry nor an island chunk is in what the HTML declares (ADR 0006, section 6)
  const entry = new RegExp(`^${ISLANDS_PREFIX}${island.entry}-[^/]+\\.js$`)
  const preloaded = declaredScripts.filter(path => entry.test(path) || path.startsWith(`${ISLANDS_PREFIX}chunks/`))
  // `requests` counts every request, so a file fetched twice (page and worker) shows
  return { ...islandMetrics(files), requests: after.length, strayRequests: before.length + preloaded.length, strayUrls: [...before, ...preloaded] }
}

/** Opens the search palette of a static page and measures what loads from then on, against `islands.search` */
async function measureSearchIsland(browser, url, declaredScripts) {
  const context = await browser.newContext({ viewport: { width: 412, height: 823 }, isMobile: true })
  const page = await context.newPage()
  const paths = []
  page.on('request', request => paths.push(new URL(request.url()).pathname))
  await page.goto(url, { waitUntil: 'networkidle' })
  const initial = paths.length
  // Only the island's upgrade sets aria-keyshortcuts on the button, so waiting for it waits for the upgrade
  await page.locator('button[aria-keyshortcuts]').first().click()
  await page.getByRole('dialog').getByRole('combobox').fill(searchQuery)
  await page.getByRole('option').first().waitFor()
  await page.waitForLoadState('networkidle')
  await context.close()
  const loaded = [...new Set(paths.slice(initial).filter(path => path.startsWith('/pagefind/')))]
  const files = await Promise.all(loaded.map(async path => ({ path, ...(await fetchAsSent(new URL(path, url).href)) })))
  const kb = value => Math.round(value / 10.24) / 100
  const loader = declaredScripts.find(path => path.startsWith('/_islands/'))
  const runtime = files.filter(file => /\/pagefind(?:-worker)?\.js$/.test(file.path))
  return {
    loaderGzKb: loader ? kb((await fetchAsSent(new URL(loader, url).href)).gzip) : undefined,
    pagefindGzKb: kb(runtime.reduce((sum, file) => sum + file.gzip, 0)),
    wasmKb: kb(Math.max(0, ...files.filter(file => /\.pagefind$/.test(file.path) && /wasm/.test(file.path)).map(file => file.sent))),
    requests: loaded.length,
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

/** The limits of a page and level; a recorded exception for the theme overrides single metrics */
function limitsFor(page, level) {
  const global = modeBudgets.limits[page]?.[level] ?? {}
  const limits = { ...global, ...(exception?.limits?.[page]?.[level] ?? {}) }
  if (level === 'error' && extraFontKb && limits.fontKb !== undefined) limits.fontKb = Math.round((limits.fontKb + extraFontKb) * 10) / 10
  return limits
}

function compare(page, metrics, limits, level) {
  return Object.entries(limits ?? {}).flatMap(([metric, limit]) => {
    const value = metrics[metric]
    const over = HIGHER_IS_BETTER.has(metric) ? value < limit : value > limit
    return over ? [{ level, page, metric, value, limit }] : []
  })
}

function summaryTable(report) {
  const columns = ['jsKb', 'jsGzipKb', ...(isStatic ? ['initialJsGzKb'] : []), 'strayRequests', 'cssKb', 'htmlKb', 'fontKb', 'thirdPartyRequests', 'lcpMs', 'tbtMs', 'cls', 'performance', 'accessibility']
  const lines = [`| Page | ${columns.join(' | ')} |`, `| --- | ${columns.map(() => '---:').join(' | ')} |`]
  for (const row of report) lines.push(`| ${row.page} | ${columns.map(c => row.metrics[c]).join(' | ')} |`)
  return lines.join('\n')
}

// A static build is generated here (the mock Strapi lives only while it runs), so the run measures the code at hand;
// --skip-generate reuses .output/public
if (args.serve && isStatic && !args['skip-generate']) {
  const code = await generateStatic({ mockPort: MOCK_PORT, appPort: SERVER_PORT, mode, siteUrl: base, extraEnv: { NUXT_PUBLIC_THEME: theme, ...(displayFont && { MOCK_DISPLAY_FONT: displayFont }) } })
  if (code !== 0) throw new Error(`npm run generate failed (${label})`)
  mkdirSync(dirname(BUILD_MARKER), { recursive: true })
  writeFileSync(BUILD_MARKER, JSON.stringify({ theme, mode }) + '\n')
} else if (args.serve && isStatic) {
  // --skip-generate measures what is there: it must be the theme and mode asked for
  const built = existsSync(BUILD_MARKER) ? JSON.parse(readFileSync(BUILD_MARKER, 'utf8')) : undefined
  if (!built) throw new Error('--skip-generate: .output/public was not generated by this script (no marker); run without it')
  if (built.theme !== theme || built.mode !== mode) throw new Error(`--skip-generate: .output/public was generated for theme ${built.theme}, ${built.mode} mode, not ${label}`)
}
const servers = args.serve ? (isStatic ? [startStaticServer()] : startServers()) : []
let browser
try {
  if (args.serve) {
    if (!isStatic) await waitFor(`http://127.0.0.1:${MOCK_PORT}/api/articles`, servers)
    await waitFor(base, servers)
  }
  browser = await chromium.launch({ channel: 'chromium', args: [`--remote-debugging-port=${DEBUG_PORT}`] })
  const report = []
  const problems = []
  const islands = {}
  for (const { name, path } of pages) {
    const url = new URL(path, base).href
    await fetch(url)
    const { html, stylesheets, declaredScripts, ...weight } = await measureWeight(url)
    const metrics = { ...weight, ...(await observeLoad(browser, url, declaredScripts)), ...(await measureLighthouse(url)) }
    problems.push(...compare(name, metrics, limitsFor(name, 'error'), 'error'), ...compare(name, metrics, limitsFor(name, 'warn'), 'warn'))
    for (const message of checkFouc(html, url, stylesheets)) problems.push({ level: 'error', page: name, message })
    // The run proves nothing if the font never reached the page (a theme using it itself emits nothing)
    if (displayFont && themeDisplayFamily() !== displayFont.replace(/-/g, ' ') && !html.includes(`/fonts/display/${displayFont}-latin-wght.woff2`)) {
      problems.push({ level: 'error', page: name, message: `the display font "${displayFont}" is not in the page` })
    }
    report.push({ page: name, path, metrics })
    if (!isStatic) delete metrics.initialJsGzKb
    const { thirdPartyUrls, strayUrls, ...printable } = metrics
    console.log(`${name.padEnd(10)} ${JSON.stringify(printable)}`)
    if (thirdPartyUrls.length) console.log(`           third party: ${thirdPartyUrls.join(', ')}`)
    if (strayUrls?.length) console.log(`           not in the initial load: ${strayUrls.join(', ')}`)
    // The search island, once, on the first page: the same palette is on every page (e2e/static/search.spec.ts checks that)
    if (isStatic && modeBudgets.islands?.search && !islands.search) {
      islands.search = await measureSearchIsland(browser, url, declaredScripts)
      console.log(`island     search ${JSON.stringify(islands.search)}`)
      problems.push(...islandProblems('search', islands.search, modeBudgets.islands.search.error))
    }
  }
  // Each heavy island once, on the fixture page of its budget
  for (const island of heavyIslands) {
    const budget = modeBudgets.islands[island.budget]
    const { problem, strayUrls, ...measured } = await measureHeavyIsland(browser, island, budget)
    if (problem) {
      problems.push({ level: 'error', page: `island ${island.id}`, message: problem })
      continue
    }
    islands[island.id] = measured
    console.log(`island     ${island.id} ${JSON.stringify(measured)}`)
    if (strayUrls.length) console.log(`           before the trigger: ${strayUrls.join(', ')}`)
    problems.push(...islandProblems(island.id, measured, { ...budget.error, strayRequests: 0 }))
  }

  if (args.out) writeFileSync(args.out, JSON.stringify({ theme, mode, ...(displayFont && { displayFont }), pages: report, ...(Object.keys(islands).length && { islands }) }, null, 2) + '\n')
  const lines = problems.map((p) => {
    const prefix = `${p.level === 'error' ? 'ERROR' : 'warn '} [${label}] ${p.page}:`
    if (p.message) return `${prefix} ${p.page.startsWith('island ') ? '' : 'FOUC: '}${p.message}`
    const verb = HIGHER_IS_BETTER.has(p.metric) ? 'is below' : 'exceeds'
    return `${prefix} ${p.metric} ${p.value} ${verb} the budget of ${p.limit}`
  })
  if (lines.length) console.log('\n' + lines.join('\n'))
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Performance (${label})\n\n${exception ? `Recorded exception: ${exception.reason}\n\n` : ''}${summaryTable(report)}\n\n${Object.entries(islands).map(([id, value]) => `Island ${id}: \`${JSON.stringify(value)}\`\n\n`).join('')}${lines.map(l => `- ${l}`).join('\n')}\n`)
  }
  if (args.check && problems.some(p => p.level === 'error')) process.exitCode = 1
} finally {
  await browser?.close()
  for (const server of servers) server.kill()
}
