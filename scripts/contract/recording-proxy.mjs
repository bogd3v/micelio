#!/usr/bin/env node
// A pass-through proxy between the frontend and the CMS that records every request it forwards, one JSON line per request, so the
// mock check (e2e/contract/mock-shape.spec.ts) repeats the very requests the frontend makes instead of a list that can go stale.
// Environment: PROXY_PORT, TARGET_URL (the CMS), RECORD_FILE.
import { appendFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'

const port = Number(process.env.PROXY_PORT)
const target = process.env.TARGET_URL
const recordFile = process.env.RECORD_FILE
if (!port || !target || !recordFile) throw new Error('PROXY_PORT, TARGET_URL and RECORD_FILE are required')
writeFileSync(recordFile, '')

async function readBody(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return Buffer.concat(chunks)
}

createServer(async (request, response) => {
  const body = await readBody(request)
  const headers = { ...request.headers }
  delete headers.host
  const upstream = await fetch(`${target}${request.url}`, { method: request.method, headers, ...(body.length ? { body } : {}), redirect: 'manual' })
  appendFileSync(recordFile, `${JSON.stringify({ method: request.method, url: request.url, status: upstream.status })}\n`)
  const payload = Buffer.from(await upstream.arrayBuffer())
  const outgoing = Object.fromEntries([...upstream.headers].filter(([name]) => !['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(name)))
  response.writeHead(upstream.status, { ...outgoing, 'content-length': payload.length })
  response.end(payload)
}).listen(port, '127.0.0.1')
