import { isWorkerScriptPath, workerPolicy } from '~/helpers/securityHeaders'

/**
 * The response that serves a Worker script carries its own policy: a Worker takes its CSP from there, not from the page (ADR 0004,
 * worker containment). Set on `request`, before Nitro serves the file from its public assets, and read at request time because the
 * site URL is runtime config. The static build writes the same rule in `_headers`.
 */
export default defineNitroPlugin((nitroApp) => {
  if (import.meta.dev) return
  const config = useRuntimeConfig()
  // No safe fallback exists for the origin: say it at boot, and refuse to serve the Worker without its policy
  if (!workerPolicy(config.public.siteUrl, config.app.baseURL)) {
    console.error('NUXT_PUBLIC_SITE_URL is unset or not a valid origin: the playground\'s Worker cannot get its CSP, so /_islands/workers/ answers 503 and runnable code stays on its fallback.')
  }
  nitroApp.hooks.hook('request', (event) => {
    const { app, public: site } = useRuntimeConfig(event)
    if (!isWorkerScriptPath(event.path, app.baseURL)) return
    const policy = workerPolicy(site.siteUrl, app.baseURL)
    if (!policy) {
      // Answered here: a thrown error in this hook is not turned into a response, and the static handler would serve the file
      setResponseStatus(event, 503, 'The Worker policy needs NUXT_PUBLIC_SITE_URL')
      event.node.res.end()
      return
    }
    setResponseHeader(event, 'content-security-policy', policy)
  })
})
