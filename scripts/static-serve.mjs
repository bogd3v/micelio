// A small static server for a `nuxt generate` output (e2e/static, local preview). No dependencies.
// Usage: node scripts/static-serve.mjs [dir] ; PORT and HOST env variables (defaults 3230, 127.0.0.1)
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'

const root = resolve(process.argv[2] ?? '.output/public')
const port = Number(process.env.PORT ?? 3230)
const host = process.env.HOST ?? '127.0.0.1'

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
    const body = await readFile(found)
    res.writeHead(file ? 200 : 404, { 'Content-Type': type })
    res.end(req.method === 'HEAD' ? undefined : body)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
  }
})

server.listen(port, host, () => console.log(`Serving ${root} at http://${host}:${port}`))
