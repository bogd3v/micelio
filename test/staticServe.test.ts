import { spawn } from 'node:child_process'
import { get } from 'node:http'
import type { ChildProcess } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { brotliDecompressSync } from 'node:zlib'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// scripts/static-serve.mjs backs the builder image's `serve`, which keeps running while `generate` rewrites the site
const PORT = 3995
const page = (marker: string): string => `<!doctype html><title>${marker}</title>${'<p>padding</p>'.repeat(200)}`

let dir: string
let server: ChildProcess

function fetchBrotli(path: string): Promise<{ text: string, csp: string | undefined }> {
  return new Promise((resolve, reject) => {
    get({ host: '127.0.0.1', port: PORT, path, headers: { 'Accept-Encoding': 'br' } }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        const body = Buffer.concat(chunks)
        const text = res.headers['content-encoding'] === 'br' ? brotliDecompressSync(body).toString() : body.toString()
        resolve({ text, csp: res.headers['content-security-policy'] as string | undefined })
      })
    }).on('error', reject)
  })
}

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      await fetch(`http://127.0.0.1:${PORT}/`)
      return
    } catch {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  throw new Error('static-serve did not start')
}

describe('static-serve', () => {
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'micelio-serve-'))
    await writeFile(join(dir, 'index.html'), page('first'))
    await writeFile(join(dir, '_headers'), '/*\n  Content-Security-Policy: script-src \'sha256-first\'\n')
    server = spawn('node', ['scripts/static-serve.mjs', dir], { env: { ...process.env, PORT: String(PORT), COMPRESS: '1' }, stdio: 'ignore' })
    await waitForServer()
  })

  afterAll(async () => {
    server.kill()
    await rm(dir, { recursive: true, force: true })
  })

  it('serves a regenerated page and its new headers without a restart', async () => {
    const before = await fetchBrotli('/')
    expect(before.text).toContain('<title>first</title>')
    expect(before.csp).toContain('sha256-first')

    await writeFile(join(dir, 'index.html'), page('second, a longer title'))
    await writeFile(join(dir, '_headers'), '/*\n  Content-Security-Policy: script-src \'sha256-second\'\n')

    const after = await fetchBrotli('/')
    expect(after.text).toContain('<title>second, a longer title</title>')
    expect(after.csp).toContain('sha256-second')
    expect(after.csp).not.toContain('sha256-first')
  })
})
