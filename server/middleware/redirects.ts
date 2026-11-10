// A published page whose slug changed answers 301 at its old address (docs/api.md, Redirects). It runs before the page routes
export default defineEventHandler(async (event) => {
  if (event.method !== 'GET' && event.method !== 'HEAD') return
  const query = event.path.indexOf('?')
  const pathname = query < 0 ? event.path : event.path.slice(0, query)
  // The health route reads no CMS and is never redirected: a slow or failing CMS must not make a container unhealthy (docs/api.md, Routes outside /api)
  if (pathname === '/_health') return
  const target = await redirectFor(pathname)
  if (!target) return
  // A redirect the plugin removes (a page back at its address) must not outlive its list in a cache
  setHeader(event, 'Cache-Control', 'public, max-age=60')
  return sendRedirect(event, query < 0 ? target : `${target}${event.path.slice(query)}`, 301)
})
