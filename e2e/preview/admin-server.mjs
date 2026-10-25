// The admin side of the preview for e2e/preview: static pages on `http://localhost:<ADMIN_PORT>` (another site than the frontend at
// 127.0.0.1) that frame a draft and talk to it as the CMS admin page does. The same files are served on `http://127.0.0.1:<ADMIN_PORT>`
// too, which is another origin: the "stranger" that must not be heard.
import { createServer } from 'node:http'

const port = Number(process.env.ADMIN_PORT ?? 4400)

// Records every message the frame posts, with the origin and whether the sender is the frame; `send` posts one to the frame
const ADMIN_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Admin</title></head>
<body>
<iframe id="draft" title="Draft" width="900" height="700"></iframe>
<script src="/admin.js"></script>
</body></html>`

const ADMIN_SCRIPT = `
const params = new URLSearchParams(location.search)
const frame = document.getElementById('draft')
window.received = []
window.addEventListener('message', (event) => {
  window.received.push({ origin: event.origin, fromFrame: event.source === frame.contentWindow, data: event.data })
})
// Posts to the frame, to the origin the draft is on
window.send = (data, origin) => frame.contentWindow.postMessage(data, origin)
// Adds a sibling frame that posts \`data\` to the draft frame (a frame of this page, \`frames[0]\`)
window.addSibling = (src) => new Promise((resolve) => {
  const sibling = document.createElement('iframe')
  sibling.addEventListener('load', () => resolve())
  sibling.src = src
  document.body.append(sibling)
})
frame.src = params.get('src')
`

// A page that posts a load-draft to the draft frame of the page that holds it, as another window would
const SIBLING_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Sibling</title></head>
<body><script>
const params = new URLSearchParams(location.search)
const message = { v: 1, type: 'load-draft', payload: { documentId: params.get('documentId'), locale: params.get('locale') || null } }
parent.frames[0].postMessage(message, params.get('target'))
</script></body></html>`

const FILES = {
  '/admin.html': ['text/html; charset=utf-8', ADMIN_PAGE],
  '/admin.js': ['text/javascript; charset=utf-8', ADMIN_SCRIPT],
  '/sibling.html': ['text/html; charset=utf-8', SIBLING_PAGE],
}

createServer((req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost')
  const file = FILES[pathname]
  if (!file) {
    res.writeHead(404).end()
    return
  }
  res.writeHead(200, { 'Content-Type': file[0], 'Cache-Control': 'no-store' }).end(file[1])
}).listen(port)
