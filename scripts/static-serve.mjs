// A small static server for a `nuxt generate` output (e2e/static, local preview). No dependencies.
// Usage: node scripts/static-serve.mjs [dir] ; PORT and HOST env variables (defaults 3260, 127.0.0.1)
// COMPRESS=1 answers text files in brotli or gzip, as the hosts do (scripts/perf measures a compressed site)
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'

const root = resolve(process.argv[2] ?? '.output/public')
const port = Number(process.env.PORT ?? 3260)
const host = process.env.HOST ?? '127.0.0.1'
const compress = process.env.COMPRESS === '1'
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.mjs', '.json', '.xml', '.txt', '.svg'])
const compressed = new Map()

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

// `_headers` (Cloudflare Pages, Netlify): a path line, then indented `Name: value` lines. Supports `/*`, `/prefix/*` and exact paths
async function readRules() {
  const rules = []
  try {
    for (const line of (await readFile(join(root, '_headers'), 'utf8')).split('\n')) {
      if (!line.trim()) continue
      if (!/^\s/.test(line)) rules.push({ path: line.trim(), headers: {} })
      else {
        const [name, ...value] = line.trim().split(':')
        if (rules.length) rules.at(-1).headers[name.trim()] = value.join(':').trim()
      }
    }
  } catch {
    // No _headers: no extra headers
  }
  return rules
}

function headersFor(rules, pathname) {
  const headers = {}
  for (const { path, headers: own } of rules) {
    const matches = path.endsWith('*') ? pathname.startsWith(path.slice(0, -1)) : pathname === path
    // A header repeated by several matching rules is joined with a comma, as Cloudflare Pages does (policies only tighten)
    if (matches) for (const [name, value] of Object.entries(own)) headers[name] = headers[name] ? `${headers[name]}, ${value}` : value
  }
  return headers
}

const rules = await readRules()

async function isFile(path) {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

// /a -> a, a.html, a/index.html (what Cloudflare Pages and Netlify do)
async function find(pathname) {
  const path = normalize(join(root, decodeURIComponent(pathname)))
  if (path !== root && !path.startsWith(`${root}/`)) return undefined
  for (const candidate of [path, `${path}.html`, join(path, 'index.html')]) {
    if (await isFile(candidate)) return candidate
  }
  return undefined
}

const server = createServer(async (req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
  const file = await find(pathname).catch(() => undefined)
  const found = file ?? join(root, '404.html')
  const type = TYPES[extname(found)] ?? 'application/octet-stream'
  try {
    let body = await readFile(found)
    const headers = { ...headersFor(rules, pathname), 'Content-Type': type }
    const accepted = String(req.headers['accept-encoding'] ?? '')
    const encoding = compress && COMPRESSIBLE.has(extname(found)) && body.length > 1024 ? (/\bbr\b/.test(accepted) ? 'br' : /\bgzip\b/.test(accepted) ? 'gzip' : undefined) : undefined
    if (encoding) {
      const key = `${encoding}:${found}`
      if (!compressed.has(key)) compressed.set(key, encoding === 'br' ? brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }) : gzipSync(body, { level: 9 }))
      body = compressed.get(key)
      headers['Content-Encoding'] = encoding
      headers.Vary = 'Accept-Encoding'
    }
    res.writeHead(file ? 200 : 404, headers)
    res.end(req.method === 'HEAD' ? undefined : body)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
  }
})

server.listen(port, host, () => console.log(`Serving ${root} at http://${host}:${port}`))

// As PID 1 in a container, Node ignores SIGTERM unless it has a handler
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => process.exit(0))
