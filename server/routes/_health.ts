import pkg from '../../package.json'

// What the host check of the CMS plugin reads to know the frontend's release line (`frontend-release-line`; docs/api.md, "Routes outside /api"). The version only, bundled at build time: no call to the CMS or any upstream, so it answers while the CMS is down
export default defineEventHandler((event) => {
  if (event.method !== 'GET' && event.method !== 'HEAD') {
    setHeader(event, 'Allow', 'GET, HEAD')
    throw problem('methodNotAllowed')
  }
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'Content-Type', 'application/json')
  return { version: pkg.version }
})
